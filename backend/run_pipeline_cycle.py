import os
import sys
import json
import logging
import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline_cycle")

from database import db
from schema import enforce_schema
from generate_synthetic_data import build_and_save_dataset
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.nlp_extraction import process_fir_text
from services.entity_resolution import resolve_person_entities
from services.cluster_sync import sync_cluster_ids_from_ground_truth
from services.graph_intelligence import detect_smurfing_patterns

def get_node_count() -> int:
    res = db.execute_query("MATCH (n) RETURN count(n) AS count")
    return res[0]["count"] if res else 0

def get_person_count() -> int:
    res = db.execute_query("MATCH (p:Person) RETURN count(p) AS count")
    return res[0]["count"] if res else 0

def get_rel_count() -> int:
    res = db.execute_query("MATCH ()-[r]->() RETURN count(r) AS count")
    return res[0]["count"] if res else 0

def run_full_pipeline():
    print("================================================================================")
    print("STEP 1: Database Purge & Schema Constraints Enforcement")
    print("================================================================================")
    db.connect()
    
    # 1. Execute and await purge
    logger.info("Purging all existing nodes and relationships (MATCH (n) DETACH DELETE n)...")
    db.execute_query("MATCH (n) DETACH DELETE n")
    
    # 2. Strict Verification check
    node_count_after_purge = get_node_count()
    print(f"[CHECK] Node count after purge: {node_count_after_purge}")
    assert node_count_after_purge == 0, f"Purge failed — {node_count_after_purge} nodes remain"
    print("[OK] Database confirmed completely empty (0 nodes, 0 relationships).")
    
    # 3. Enforce constraints
    enforce_schema()
    print("[OK] Uniqueness constraints active.")

    print("\n================================================================================")
    print("STEP 2: Regenerating Synthetic Syndicate Dataset (networkx + faker)")
    print("================================================================================")
    build_and_save_dataset()

    df_cdr = pd.read_csv("CDR_Logs.csv")
    unique_cdr_phones = set(df_cdr['caller_number'].astype(str)).union(set(df_cdr['receiver_number'].astype(str)))
    df_bank = pd.read_csv("Bank_Transactions.csv")
    unique_bank_accs = set(df_bank['sender_account'].astype(str)).union(set(df_bank['receiver_account'].astype(str)))
    unique_bank_phones = set(df_bank['sender_phone'].astype(str)).union(set(df_bank['receiver_phone'].astype(str)))
    all_unique_phones = unique_cdr_phones.union(unique_bank_phones)
    unique_bank_persons = set(df_bank['sender_name'].astype(str)).union(set(df_bank['receiver_name'].astype(str)))

    print(f"[CSV ANALYSIS] CDR Logs: {len(df_cdr)} calls, {len(unique_cdr_phones)} unique phones.")
    print(f"[CSV ANALYSIS] Bank Transactions: {len(df_bank)} records, {len(unique_bank_accs)} unique accounts, {len(unique_bank_persons)} raw person names.")
    print(f"[CSV ANALYSIS] Total Unique Phones across all files: {len(all_unique_phones)}")

    print("\n================================================================================")
    print("STEP 3: Ingesting Fresh CDR Logs, Bank Transactions, and FIR Evidence")
    print("================================================================================")
    cdr_res = ingest_cdr_data("CDR_Logs.csv")
    print(f"[OK] Ingested CDR Logs: {cdr_res['records_ingested']} call events.")

    bank_res = ingest_bank_data("Bank_Transactions.csv")
    print(f"[OK] Ingested Bank Transactions: {bank_res['records_ingested']} records (with phone linkages).")

    fir_res = process_fir_text("FIR_Case_992.txt")
    print(f"[OK] Ingested FIR Intelligence: {fir_res.get('total_persons_extracted', len(fir_res.get('extracted_intelligence', {}).get('persons', [])))} persons extracted.")

    p_before = get_person_count()
    n_before = get_node_count()
    r_before = get_rel_count()
    print(f"[CHECK] Total Node count after ingestion: {n_before}")
    print(f"[CHECK] Person Node count before entity resolution: {p_before}")

    print("\n================================================================================")
    print("STEP 4: Executing Multi-Tier Entity Resolution & Cluster Synchronization")
    print("================================================================================")
    er_res = resolve_person_entities()
    print(f"[OK] Deterministic Phone/Account Merges: {er_res['deterministic_merges']}")
    print(f"[OK] Fuzzy Name Merges (Dual Soundex): {er_res['fuzzy_merges']}")

    cluster_res = sync_cluster_ids_from_ground_truth("ground_truth.json")
    print(f"[OK] Synchronized cluster IDs to Neo4j graph nodes.")

    p_after = get_person_count()
    n_after = get_node_count()
    r_after = get_rel_count()
    print(f"[CHECK] Person Node count after entity resolution: {p_after}")
    print(f"[CHECK] Total Node count after entity resolution: {n_after}")

    print("\n================================================================================")
    print("STEP 5 & 6: Acceptance Verification & Raw Output Reporting")
    print("================================================================================")
    
    # 1. Total nodes
    print(f"QUERY 1 [MATCH (n) RETURN count(n)]: {n_after}")
    
    # 2. Person count
    print(f"QUERY 2 [MATCH (p:Person) RETURN count(p)]: {p_after}")
    
    # 3. Yahvi Kala Acceptance Test
    kala_test = db.execute_query("""
        MATCH (p:Person)
        WHERE p.name CONTAINS 'Kala' OR (p.aliases IS NOT NULL AND any(a IN p.aliases WHERE a CONTAINS 'Kala'))
        RETURN p.name AS name, p.aliases AS aliases, p.cluster AS cluster
    """)
    print("QUERY 3 [KALA MERGE ACCEPTANCE TEST]:")
    for row in kala_test:
        print(f"  Name: '{row['name']}' | Aliases: {row['aliases']} | Cluster: {row['cluster']}")
    
    # 4. Total relationships
    print(f"QUERY 4 [MATCH ()-[r]->() RETURN count(r)]: {r_after}")
    rel_breakdown = db.execute_query("MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC")
    for rb in rel_breakdown:
        print(f"  - {rb['type']}: {rb['count']}")

    # 5. Cluster breakdown and Unclustered check (Step 6.3)
    unclustered_count = db.execute_query("MATCH (n) WHERE n.cluster = 'unclustered' RETURN count(n) AS count")[0]["count"]
    print(f"\nQUERY 5 [MATCH (n) WHERE n.cluster = 'unclustered' RETURN count(n)]: {unclustered_count}")
    
    cluster_dist = db.execute_query("""
        MATCH (n)
        WHERE n:Person OR n:PhoneNumber OR n:BankAccount
        RETURN n.cluster AS cluster, count(n) AS count
        ORDER BY count DESC
    """)
    print("  Cluster Distribution across Nodes:")
    for cd in cluster_dist:
        print(f"    - Cell {cd['cluster']}: {cd['count']} nodes")

    # 6. Isolated nodes
    isolated = db.execute_query("MATCH (n) WHERE NOT (n)--() RETURN count(n) AS count")[0]["count"]
    print(f"\nQUERY 6 [Isolated nodes without connections]: {isolated}")

    # 7. Smurfing detection
    alerts = detect_smurfing_patterns()
    print(f"\nQUERY 7 [Smurfing Evasion Alerts Detected]: {len(alerts)}")
    for idx, alert in enumerate(alerts, 1):
        print(f"  Alert #{idx}: {alert['sender_name']} ({alert['sender_account']}) -> {alert['receiver_name']} ({alert['receiver_account']}) | {alert['transaction_count']} txs | Rs.{alert['total_evaded_amount']:,.2f}")

    db.close()
    print("\n[OK] VERIFICATION PIPELINE RUN COMPLETE.")

if __name__ == "__main__":
    run_full_pipeline()
