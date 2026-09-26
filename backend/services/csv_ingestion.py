import os
import io
import logging
from typing import Dict, Any, List, Union, Optional
import pandas as pd
from database import db

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def find_csv_file(possible_filenames: List[str]) -> str:
    """Finds the first existing file from a list of candidates."""
    for filename in possible_filenames:
        if os.path.exists(filename):
            return filename
        candidate_rel = os.path.join("backend", filename)
        if os.path.exists(candidate_rel):
            return candidate_rel
    raise FileNotFoundError(f"None of the candidate files found: {possible_filenames}")


def _load_dataframe_from_source(source: Optional[Union[str, bytes, io.StringIO, pd.DataFrame]], default_names: List[str]) -> tuple[pd.DataFrame, str]:
    """Helper to parse a DataFrame from various input formats."""
    if isinstance(source, pd.DataFrame):
        return source, "DataFrame"
    
    if isinstance(source, bytes):
        df = pd.read_csv(io.BytesIO(source))
        return df, "uploaded_bytes.csv"

    if isinstance(source, io.StringIO):
        df = pd.read_csv(source)
        return df, "uploaded_text.csv"

    if isinstance(source, str):
        # Check if source is CSV content or file path
        if "\n" in source or "," in source and not os.path.exists(source):
            df = pd.read_csv(io.StringIO(source))
            return df, "uploaded_string.csv"
        if os.path.exists(source):
            df = pd.read_csv(source)
            return df, source

    # Fall back to searching default candidate filenames
    path = find_csv_file(default_names)
    df = pd.read_csv(path)
    return df, path


def _normalize_col_names(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names: trim and lower-case with underscores."""
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(' ', '_').replace('-', '_') for c in df.columns]
    return df


def ingest_cdr_data(
    file_source: Optional[Union[str, bytes, io.StringIO, pd.DataFrame]] = None,
    case_id: Optional[str] = "FIR-992/2026"
) -> Dict[str, Any]:
    """
    Reads CDR logs CSV/DataFrame/Upload, standardizes headers, batches records,
    and executes UNWIND Cypher queries to create PhoneNumber nodes and [:CALLED] relationship edges,
    tagging them with the active case_id.
    """
    df, source_label = _load_dataframe_from_source(file_source, ["CDR_Logs.csv", "e:/SIH26189/backend/CDR_Logs.csv", "e:/SIH26189/CDR_Logs.csv"])
    df = _normalize_col_names(df)

    active_case = str(case_id or "FIR-992/2026").strip()
    logger.info(f"Ingesting CDR Data from: {source_label} ({len(df)} rows, Case: {active_case})")

    # Validate required CDR schema columns
    has_caller = any(c in df.columns for c in ['caller_number', 'caller', 'calling_number', 'from_number', 'caller_msisdn', 'source', 'from'])
    has_receiver = any(c in df.columns for c in ['receiver_number', 'receiver', 'called_number', 'to_number', 'receiver_msisdn', 'destination', 'to'])
    if not has_caller or not has_receiver:
        raise ValueError(
            f"Invalid CDR CSV schema: Missing required column headers. Expected caller (e.g. 'caller_number') and receiver (e.g. 'receiver_number'). Found columns: {list(df.columns)}"
        )

    # Map possible column header aliases
    def get_col(candidates: List[str], default_val="") -> pd.Series:
        for cand in candidates:
            if cand in df.columns:
                return df[cand]
        return pd.Series([default_val] * len(df))

    caller_series = get_col(['caller_number', 'caller', 'calling_number', 'from_number', 'caller_msisdn', 'source', 'from'])
    receiver_series = get_col(['receiver_number', 'receiver', 'called_number', 'to_number', 'receiver_msisdn', 'destination', 'to'])
    date_series = get_col(['call_date', 'date', 'transaction_date', 'timestamp_date'])
    time_series = get_col(['call_time', 'time', 'transaction_time'])
    duration_series = get_col(['duration_seconds', 'duration', 'call_duration', 'call_duration_seconds'], 0)
    tower_series = get_col(['tower_location', 'tower', 'location', 'cell_id', 'tower_id', 'bts_id'], "Unknown Tower")

    caller_col = caller_series.astype(str).str.strip()
    receiver_col = receiver_series.astype(str).str.strip()
    date_col = date_series.astype(str).str.strip()
    time_col = time_series.astype(str).str.strip()
    duration_col = pd.to_numeric(duration_series, errors='coerce').fillna(0).astype(int)
    tower_col = tower_series.astype(str).str.strip()

    records = []
    for i in range(len(df)):
        c_num = caller_col.iloc[i]
        r_num = receiver_col.iloc[i]
        
        # Skip empty / invalid row entries
        if not c_num or c_num == 'nan' or not r_num or r_num == 'nan':
            continue

        d_str = date_col.iloc[i]
        t_str = time_col.iloc[i]
        timestamp = f"{d_str} {t_str}".strip() if d_str and d_str != 'nan' else f"RECORD_{i+1}"

        records.append({
            "caller_number": c_num,
            "receiver_number": r_num,
            "timestamp": timestamp,
            "duration": int(duration_col.iloc[i]),
            "tower": tower_col.iloc[i] if tower_col.iloc[i] and tower_col.iloc[i] != 'nan' else "Unknown Tower",
            "case_id": active_case
        })

    if not records:
        logger.warning(f"No valid CDR records found in {source_label}")
        return {
            "status": "warning",
            "file": source_label,
            "records_ingested": 0,
            "message": "No valid CDR call records parsed."
        }

    cypher_query = """
    UNWIND $batch AS row
    // Merge caller and receiver phone nodes idempotently
    MERGE (caller:PhoneNumber {number: row.caller_number})
      ON CREATE SET caller.number = row.caller_number,
                    caller.case_id = row.case_id
      ON MATCH SET caller.case_id = coalesce(caller.case_id, row.case_id)
    MERGE (receiver:PhoneNumber {number: row.receiver_number})
      ON CREATE SET receiver.number = row.receiver_number,
                    receiver.case_id = row.case_id
      ON MATCH SET receiver.case_id = coalesce(receiver.case_id, row.case_id)

    // Merge CALLED relationship to prevent duplicate call edges
    MERGE (caller)-[c:CALLED {timestamp: row.timestamp}]->(receiver)
      ON CREATE SET c.duration = row.duration,
                    c.tower = row.tower,
                    c.case_id = row.case_id
      ON MATCH SET c.duration = row.duration,
                   c.tower = row.tower,
                   c.case_id = coalesce(c.case_id, row.case_id)
    """

    total_records = len(records)
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        db.execute_query(cypher_query, {"batch": batch})

    logger.info(f"Successfully ingested {total_records} CDR records into Neo4j from {source_label} (Case: {active_case}).")
    return {
        "status": "success",
        "file": source_label,
        "records_ingested": total_records,
        "relationship": "CALLED",
        "case_id": active_case
    }


def ingest_bank_data(
    file_source: Optional[Union[str, bytes, io.StringIO, pd.DataFrame]] = None,
    case_id: Optional[str] = "FIR-992/2026"
) -> Dict[str, Any]:
    """
    Reads Bank Transactions CSV/DataFrame/Upload, standardizes headers, batches records,
    and executes UNWIND Cypher queries to create Person and BankAccount nodes,
    [:OWNS_ACCOUNT] edges, and [:TRANSFERRED_TO] edges, tagging them with the active case_id.
    """
    df, source_label = _load_dataframe_from_source(file_source, ["Bank_Transactions.csv", "e:/SIH26189/backend/Bank_Transactions.csv", "e:/SIH26189/Bank_Transactions.csv"])
    df = _normalize_col_names(df)

    active_case = str(case_id or "FIR-992/2026").strip()
    logger.info(f"Ingesting Bank Transactions from: {source_label} ({len(df)} rows, Case: {active_case})")

    # Validate required Bank schema columns
    has_sender = any(c in df.columns for c in ['sender_account', 'sender_acc', 'from_account', 'payer_account', 'debit_account', 'account_from', 'sender_account_no', 'sender_name', 'sender'])
    has_receiver = any(c in df.columns for c in ['receiver_account', 'receiver_acc', 'to_account', 'payee_account', 'credit_account', 'account_to', 'receiver_account_no', 'receiver_name', 'receiver'])
    if not has_sender or not has_receiver:
        raise ValueError(
            f"Invalid Bank CSV schema: Missing required column headers. Expected sender (e.g. 'sender_account') and receiver (e.g. 'receiver_account'). Found columns: {list(df.columns)}"
        )

    def get_col(candidates: List[str], default_val="") -> pd.Series:
        for cand in candidates:
            if cand in df.columns:
                return df[cand]
        return pd.Series([default_val] * len(df))

    s_name_series = get_col(['sender_name', 'sender', 'from_name', 'payer_name', 'remitter', 'remitter_name', 'source_name'])
    s_acc_series = get_col(['sender_account', 'sender_acc', 'from_account', 'payer_account', 'debit_account', 'account_from', 'sender_account_no'])
    s_phone_series = get_col(['sender_phone', 'sender_mobile', 'from_phone', 'payer_phone'])
    
    r_name_series = get_col(['receiver_name', 'receiver', 'to_name', 'payee_name', 'beneficiary', 'beneficiary_name', 'destination_name'])
    r_acc_series = get_col(['receiver_account', 'receiver_acc', 'to_account', 'payee_account', 'credit_account', 'account_to', 'receiver_account_no'])
    r_phone_series = get_col(['receiver_phone', 'receiver_mobile', 'to_phone', 'payee_phone'])
    
    amount_series = get_col(['amount_inr', 'amount', 'transaction_amount', 'txn_amount', 'transfer_amount', 'inr_amount'], 0.0)
    date_series = get_col(['transaction_date', 'date', 'txn_date', 'value_date', 'transfer_date'])
    remarks_series = get_col(['remarks', 'description', 'narration', 'purpose', 'transaction_remarks'], "Fund Transfer")

    records = []
    for i in range(len(df)):
        s_acc = str(s_acc_series.iloc[i]).strip()
        r_acc = str(r_acc_series.iloc[i]).strip()
        
        if not s_acc or s_acc == 'nan' or not r_acc or r_acc == 'nan':
            continue

        s_name = str(s_name_series.iloc[i]).strip()
        if not s_name or s_name == 'nan':
            s_name = f"AccountHolder_{s_acc}"

        r_name = str(r_name_series.iloc[i]).strip()
        if not r_name or r_name == 'nan':
            r_name = f"AccountHolder_{r_acc}"

        s_phone = str(s_phone_series.iloc[i]).strip() if pd.notna(s_phone_series.iloc[i]) and str(s_phone_series.iloc[i]).strip() != 'nan' else None
        r_phone = str(r_phone_series.iloc[i]).strip() if pd.notna(r_phone_series.iloc[i]) and str(r_phone_series.iloc[i]).strip() != 'nan' else None

        amt_val = float(pd.to_numeric(amount_series.iloc[i], errors='coerce') or 0.0)
        d_val = str(date_series.iloc[i]).strip() if pd.notna(date_series.iloc[i]) and str(date_series.iloc[i]).strip() != 'nan' else "UNKNOWN_DATE"
        rem_val = str(remarks_series.iloc[i]).strip() if pd.notna(remarks_series.iloc[i]) and str(remarks_series.iloc[i]).strip() != 'nan' else "Fund Transfer"

        records.append({
            "sender_name": s_name,
            "sender_account": s_acc,
            "sender_phone": s_phone,
            "receiver_name": r_name,
            "receiver_account": r_acc,
            "receiver_phone": r_phone,
            "amount": amt_val,
            "date": d_val,
            "remarks": rem_val,
            "case_id": active_case
        })

    if not records:
        logger.warning(f"No valid Bank Transaction records found in {source_label}")
        return {
            "status": "warning",
            "file": source_label,
            "records_ingested": 0,
            "message": "No valid bank transaction records parsed."
        }

    cypher_query = """
    UNWIND $batch AS row
    // Sender Person & BankAccount
    MERGE (senderPerson:Person {name: row.sender_name})
      ON CREATE SET senderPerson.name = row.sender_name,
                    senderPerson.case_id = row.case_id
      ON MATCH SET senderPerson.case_id = coalesce(senderPerson.case_id, row.case_id)
    MERGE (senderAcc:BankAccount {account_id: row.sender_account})
      ON CREATE SET senderAcc.account_id = row.sender_account,
                    senderAcc.case_id = row.case_id
      ON MATCH SET senderAcc.case_id = coalesce(senderAcc.case_id, row.case_id)
    MERGE (senderPerson)-[:OWNS_ACCOUNT]->(senderAcc)

    // Link Sender Phone if provided
    FOREACH (_ IN CASE WHEN row.sender_phone IS NOT NULL AND row.sender_phone <> '' AND row.sender_phone <> 'nan' THEN [1] ELSE [] END |
      MERGE (sPhone:PhoneNumber {number: row.sender_phone})
        ON CREATE SET sPhone.case_id = row.case_id
      MERGE (senderPerson)-[:OWNS_PHONE]->(sPhone)
    )

    // Receiver Person & BankAccount
    MERGE (receiverPerson:Person {name: row.receiver_name})
      ON CREATE SET receiverPerson.name = row.receiver_name,
                    receiverPerson.case_id = row.case_id
      ON MATCH SET receiverPerson.case_id = coalesce(receiverPerson.case_id, row.case_id)
    MERGE (receiverAcc:BankAccount {account_id: row.receiver_account})
      ON CREATE SET receiverAcc.account_id = row.receiver_account,
                    receiverAcc.case_id = row.case_id
      ON MATCH SET receiverAcc.case_id = coalesce(receiverAcc.case_id, row.case_id)
    MERGE (receiverPerson)-[:OWNS_ACCOUNT]->(receiverAcc)

    // Link Receiver Phone if provided
    FOREACH (_ IN CASE WHEN row.receiver_phone IS NOT NULL AND row.receiver_phone <> '' AND row.receiver_phone <> 'nan' THEN [1] ELSE [] END |
      MERGE (rPhone:PhoneNumber {number: row.receiver_phone})
        ON CREATE SET rPhone.case_id = row.case_id
      MERGE (receiverPerson)-[:OWNS_PHONE]->(rPhone)
    )

    // Transaction Relationship (Idempotent MERGE based on accounts, date, amount, and remarks)
    MERGE (senderAcc)-[t:TRANSFERRED_TO {
        date: row.date,
        amount: row.amount,
        remarks: row.remarks
    }]->(receiverAcc)
      ON CREATE SET t.amount = row.amount,
                    t.date = row.date,
                    t.remarks = row.remarks,
                    t.case_id = row.case_id
      ON MATCH SET t.amount = row.amount,
                   t.date = row.date,
                   t.remarks = row.remarks,
                   t.case_id = coalesce(t.case_id, row.case_id)
    """

    total_records = len(records)
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        db.execute_query(cypher_query, {"batch": batch})

    logger.info(f"Successfully ingested {total_records} Bank Transaction records into Neo4j from {source_label} (Case: {active_case}).")
    return {
        "status": "success",
        "file": source_label,
        "records_ingested": total_records,
        "relationships": ["OWNS_ACCOUNT", "TRANSFERRED_TO"],
        "case_id": active_case
    }
