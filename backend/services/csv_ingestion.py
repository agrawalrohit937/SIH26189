import os
import logging
from typing import Dict, Any, List
import pandas as pd
from database import db

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def find_csv_file(possible_filenames: List[str]) -> str:
    """Finds the first existing file from a list of candidates."""
    for filename in possible_filenames:
        if os.path.exists(filename):
            return filename
    raise FileNotFoundError(f"None of the candidate files found: {possible_filenames}")


def ingest_cdr_data(file_path: str = None) -> Dict[str, Any]:
    """
    Reads CDR logs CSV, batches records, and executes UNWIND Cypher queries
    to create PhoneNumber nodes and [:CALLED] relationship edges.
    """
    if file_path is None or not os.path.exists(file_path):
        file_path = find_csv_file(["CDR_Logs.csv", "CDR_Logos.csv", "e:/SIH26189/CDR_Logos.csv", "e:/SIH26189/CDR_Logs.csv"])

    logger.info(f"Ingesting CDR Data from: {file_path}")
    df = pd.read_csv(file_path)

    # Clean and standardize columns
    df['caller_number'] = df['caller_number'].astype(str).str.strip()
    df['receiver_number'] = df['receiver_number'].astype(str).str.strip()
    df['call_date'] = df['call_date'].astype(str).str.strip()
    df['call_time'] = df['call_time'].astype(str).str.strip()
    df['timestamp'] = df['call_date'] + ' ' + df['call_time']
    df['duration_seconds'] = pd.to_numeric(df['duration_seconds'], errors='coerce').fillna(0).astype(int)
    df['tower_location'] = df['tower_location'].astype(str).str.strip()

    records = []
    for _, row in df.iterrows():
        records.append({
            "caller_number": row['caller_number'],
            "receiver_number": row['receiver_number'],
            "timestamp": row['timestamp'],
            "duration": int(row['duration_seconds']),
            "tower": row['tower_location']
        })

    cypher_query = """
    UNWIND $batch AS row
    // Merge caller and receiver phone nodes idempotently
    MERGE (caller:PhoneNumber {number: row.caller_number})
      ON CREATE SET caller.number = row.caller_number
    MERGE (receiver:PhoneNumber {number: row.receiver_number})
      ON CREATE SET receiver.number = row.receiver_number

    // Merge CALLED relationship to prevent duplicate call edges
    MERGE (caller)-[c:CALLED {timestamp: row.timestamp}]->(receiver)
      ON CREATE SET c.duration = row.duration,
                    c.tower = row.tower
      ON MATCH SET c.duration = row.duration,
                   c.tower = row.tower
    """

    total_records = len(records)
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        db.execute_query(cypher_query, {"batch": batch})

    logger.info(f"Successfully ingested {total_records} CDR records into Neo4j.")
    return {
        "status": "success",
        "file": file_path,
        "records_ingested": total_records,
        "relationship": "CALLED"
    }


def ingest_bank_data(file_path: str = None) -> Dict[str, Any]:
    """
    Reads Bank Transactions CSV, batches records, and executes UNWIND Cypher queries
    to create Person and BankAccount nodes, [:OWNS_ACCOUNT] edges, and [:TRANSFERRED_TO] edges.
    """
    if file_path is None or not os.path.exists(file_path):
        file_path = find_csv_file(["Bank_Transactions.csv", "e:/SIH26189/Bank_Transactions.csv"])

    logger.info(f"Ingesting Bank Transactions from: {file_path}")
    df = pd.read_csv(file_path)

    # Clean and standardize columns
    df['sender_name'] = df['sender_name'].astype(str).str.strip()
    df['sender_account'] = df['sender_account'].astype(str).str.strip()
    df['receiver_name'] = df['receiver_name'].astype(str).str.strip()
    df['receiver_account'] = df['receiver_account'].astype(str).str.strip()
    df['amount_inr'] = pd.to_numeric(df['amount_inr'], errors='coerce').fillna(0.0).astype(float)
    df['transaction_date'] = df['transaction_date'].astype(str).str.strip()
    df['remarks'] = df['remarks'].astype(str).str.strip()
    
    has_sender_phone = 'sender_phone' in df.columns
    has_receiver_phone = 'receiver_phone' in df.columns

    records = []
    for _, row in df.iterrows():
        s_phone = str(row['sender_phone']).strip() if has_sender_phone and pd.notna(row['sender_phone']) else None
        r_phone = str(row['receiver_phone']).strip() if has_receiver_phone and pd.notna(row['receiver_phone']) else None
        
        records.append({
            "sender_name": row['sender_name'],
            "sender_account": row['sender_account'],
            "sender_phone": s_phone,
            "receiver_name": row['receiver_name'],
            "receiver_account": row['receiver_account'],
            "receiver_phone": r_phone,
            "amount": float(row['amount_inr']),
            "date": row['transaction_date'],
            "remarks": row['remarks']
        })

    cypher_query = """
    UNWIND $batch AS row
    // Sender Person & BankAccount
    MERGE (senderPerson:Person {name: row.sender_name})
      ON CREATE SET senderPerson.name = row.sender_name
    MERGE (senderAcc:BankAccount {account_id: row.sender_account})
      ON CREATE SET senderAcc.account_id = row.sender_account
    MERGE (senderPerson)-[:OWNS_ACCOUNT]->(senderAcc)

    // Link Sender Phone if provided
    FOREACH (_ IN CASE WHEN row.sender_phone IS NOT NULL AND row.sender_phone <> '' THEN [1] ELSE [] END |
      MERGE (sPhone:PhoneNumber {number: row.sender_phone})
      MERGE (senderPerson)-[:OWNS_PHONE]->(sPhone)
    )

    // Receiver Person & BankAccount
    MERGE (receiverPerson:Person {name: row.receiver_name})
      ON CREATE SET receiverPerson.name = row.receiver_name
    MERGE (receiverAcc:BankAccount {account_id: row.receiver_account})
      ON CREATE SET receiverAcc.account_id = row.receiver_account
    MERGE (receiverPerson)-[:OWNS_ACCOUNT]->(receiverAcc)

    // Link Receiver Phone if provided
    FOREACH (_ IN CASE WHEN row.receiver_phone IS NOT NULL AND row.receiver_phone <> '' THEN [1] ELSE [] END |
      MERGE (rPhone:PhoneNumber {number: row.receiver_phone})
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
                    t.remarks = row.remarks
    """


    total_records = len(records)
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        db.execute_query(cypher_query, {"batch": batch})

    logger.info(f"Successfully ingested {total_records} Bank Transaction records into Neo4j.")
    return {
        "status": "success",
        "file": file_path,
        "records_ingested": total_records,
        "relationships": ["OWNS_ACCOUNT", "TRANSFERRED_TO"]
    }
