import time
import sys
import os
sys.path.append(os.path.abspath("backend"))
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from database import db
from services.csv_ingestion import _load_dataframe_from_source, _normalize_col_names
from ai_agent import chat_with_copilot
import pandas as pd

print("=== STEP 5: CREATING / VERIFYING NEO4J SCHEMA INDEXES ===")
indexes = [
    "CREATE INDEX person_name_idx IF NOT EXISTS FOR (p:Person) ON (p.name)",
    "CREATE INDEX phone_number_idx IF NOT EXISTS FOR (ph:PhoneNumber) ON (ph.number)",
    "CREATE INDEX phone_first_seen_idx IF NOT EXISTS FOR (ph:PhoneNumber) ON (ph.first_seen_date)",
    "CREATE INDEX bank_account_idx IF NOT EXISTS FOR (b:BankAccount) ON (b.account_id)"
]
for idx_q in indexes:
    try:
        db.execute_query(idx_q)
        print(f"  [+] Verified Index: {idx_q}")
    except Exception as e:
        print(f"  [-] Index error: {e}")

existing_indexes = db.execute_query("SHOW INDEXES")
print(f"Active Neo4j Indexes Count: {len(existing_indexes)}")

print("\n=== STEP 3: INGESTION TIMING BREAKDOWN ===")
# 1. Measure (a) Local CSV parsing & batch construction
t0 = time.time()
df_cdr, _ = _load_dataframe_from_source(None, ["CDR_Logs.csv", "backend/CDR_Logs.csv"])
df_cdr = _normalize_col_names(df_cdr)
df_bank, _ = _load_dataframe_from_source(None, ["Bank_Transactions.csv", "backend/Bank_Transactions.csv"])
df_bank = _normalize_col_names(df_bank)
t_local = time.time() - t0

# 2. Measure (b) Actual network round-trip for batch Cypher UNWIND writes to Neo4j Aura
t0 = time.time()
batch_records = df_cdr.to_dict("records")[:100]
db.execute_query("""
    UNWIND $batch AS row
    MERGE (c:PhoneNumber {number: row.caller_number})
    MERGE (r:PhoneNumber {number: row.receiver_number})
    MERGE (c)-[rel:CALLED {call_date: row.call_date}]->(r)
""", {"batch": batch_records})
t_network = time.time() - t0

print(f"  (a) Local CSV parsing & in-memory batch dict construction: {t_local*1000:.2f} ms ({t_local:.4f} s)")
print(f"  (b) Neo4j Aura Cloud Cypher UNWIND Network Write: {t_network*1000:.2f} ms ({t_network:.3f} s)")
print(f"  Total Ingestion Latency (Local + Cloud RTT): {(t_local + t_network)*1000:.2f} ms ({(t_local + t_network):.3f} s)")

print("\n=== STEP 2: COPILOT LATENCY BENCHMARK (AFTER CONNECTION POOLING & OPTIMIZATION) ===")
latencies = []
for i in range(5):
    t0 = time.time()
    ans = chat_with_copilot("What is the financial trail and smurfing activity for suspect Jagrati Sibal?")
    dur = (time.time() - t0) * 1000
    latencies.append(dur)
    print(f"  Iteration #{i+1} Latency: {dur:.2f} ms ({dur/1000:.2f} s)")

p50 = np.percentile(latencies, 50)
p95 = np.percentile(latencies, 95)
print(f"\n  P50 Median Latency: {p50:.2f} ms ({p50/1000:.2f} s)")
print(f"  P95 Peak Latency:   {p95:.2f} ms ({p95/1000:.2f} s)")
