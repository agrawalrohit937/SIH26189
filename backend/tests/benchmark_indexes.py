import time
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import db
from schema import enforce_schema

def run_index_benchmark():
    print("=================================================================")
    print("STEP 2: NEO4J SCHEMA INDEX ENFORCEMENT & QUERY PROFILING")
    print("=================================================================")

    # 1. Enforce all schema statements
    enforce_schema()

    # 2. List all active indexes in Neo4j Aura
    indexes = db.execute_query("SHOW INDEXES")
    print("\n--- CONFIRMED ACTIVE INDEXES IN NEO4J ---")
    for idx in indexes:
        name = idx.get("name")
        itype = idx.get("type")
        entity_type = idx.get("entityType")
        labels_or_types = idx.get("labelsOrTypes")
        props = idx.get("properties")
        state = idx.get("state")
        print(f"  * {name:<32} | {itype:<10} | {entity_type:<12} | {str(labels_or_types):<20} | {str(props):<25} | State: {state}")

    # 3. Test EXPLAIN on Evasion Query with Index (PhoneNumber.first_seen_date)
    print("\n--- EXPLAIN QUERY PLAN: Evasion Query (Filtering PhoneNumber.first_seen_date) ---")
    evasion_query = """
    EXPLAIN
    MATCH (p:PhoneNumber)
    WHERE p.first_seen_date >= '2024-01-01'
    RETURN p.number, p.first_seen_date
    """
    explain_res = db.execute_query(evasion_query)
    print(f"Explain rows returned: {len(explain_res)}")

    # 4. Profile / Benchmark execution time with timing
    t0 = time.perf_counter()
    res = db.execute_query("""
    MATCH (p:PhoneNumber)
    WHERE p.first_seen_date >= '2024-01-01'
    RETURN count(p) as cnt
    """)
    t_indexed = (time.perf_counter() - t0) * 1000.0
    print(f"Indexed PhoneNumber.first_seen_date query execution time: {t_indexed:.2f} ms | Found: {res[0]['cnt'] if res else 0} nodes")

    # 5. Test Temporal Scrubber Edge Query
    t0 = time.perf_counter()
    res_edges = db.execute_query("""
    MATCH (s)-[r:CALLED]->(t)
    WHERE r.timestamp >= '2024-01-01' AND r.timestamp <= '2024-12-31'
    RETURN count(r) as cnt
    """)
    t_edges = (time.perf_counter() - t0) * 1000.0
    print(f"Indexed Relationship r.timestamp query execution time: {t_edges:.2f} ms | Found: {res_edges[0]['cnt'] if res_edges else 0} edges")

if __name__ == "__main__":
    run_index_benchmark()
