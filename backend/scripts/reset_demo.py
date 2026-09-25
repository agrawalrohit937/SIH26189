import os
import sys
import json
import logging

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import db
from schema import enforce_schema
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.nlp_extraction import process_fir_text
from services.entity_resolution import resolve_person_entities
from services.cluster_sync import sync_cluster_ids_from_ground_truth
from services.audit_trail import log_action

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("reset_demo")


def reset_to_known_good_demo_state() -> dict:
    """
    Executes a deterministic reset to the verified known-good demo state:
    1. Purges all case data from Neo4j
    2. Enforces schema indexes and constraints
    3. Ingests fixed CDR logs, Bank transactions, and FIR Case Docket
    4. Executes 3-tier entity resolution
    5. Discovers communities dynamically via Louvain clustering (NetworkX seed=42)
    6. Logs audit block and returns summary stats
    """
    logger.info("--- [STAGE 1] Purging Ephemeral Case Data from Neo4j ---")
    db.connect()
    db.execute_query("MATCH (n) DETACH DELETE n")
    
    check_purge = db.execute_query("MATCH (n) RETURN count(n) AS c")
    remaining_nodes = check_purge[0]["c"] if check_purge else 0
    assert remaining_nodes == 0, f"Purge assertion failed: {remaining_nodes} nodes remain."
    
    logger.info("--- [STAGE 2] Enforcing Schema Constraints & Indexes ---")
    enforce_schema()
    
    logger.info("--- [STAGE 3] Ingesting Fixed Pre-Validated Evidence Dataset ---")
    cdr_res = ingest_cdr_data(os.path.join(backend_dir, "CDR_Logs.csv"))
    bank_res = ingest_bank_data(os.path.join(backend_dir, "Bank_Transactions.csv"))
    fir_res = process_fir_text(file_path=os.path.join(backend_dir, "FIR_Case_992.txt"))
    
    logger.info("--- [STAGE 4] Executing Deterministic Entity Resolution ---")
    er_res = resolve_person_entities()
    
    logger.info("--- [STAGE 5] Running Dynamic Louvain Community Discovery ---")
    cluster_res = sync_cluster_ids_from_ground_truth()
    
    logger.info("--- [STAGE 6] Compiling Final Graph Summary ---")
    nodes_summary = db.execute_query("""
        MATCH (n)
        RETURN count(n) AS total_nodes,
               count(CASE WHEN n:Person THEN 1 END) AS persons,
               count(CASE WHEN n:PhoneNumber THEN 1 END) AS phones,
               count(CASE WHEN n:BankAccount THEN 1 END) AS accounts
    """)[0]
    
    rels_summary = db.execute_query("""
        MATCH ()-[r]->()
        RETURN count(r) AS total_edges,
               count(CASE WHEN type(r) = 'CALLED' THEN 1 END) AS called,
               count(CASE WHEN type(r) = 'TRANSFERRED_TO' THEN 1 END) AS transfers,
               count(CASE WHEN type(r) = 'OWNS_PHONE' THEN 1 END) AS owns_phone,
               count(CASE WHEN type(r) = 'OWNS_ACCOUNT' THEN 1 END) AS owns_account
    """)[0]
    
    log_action(
        actor="Admin: sysadmin",
        action_type="RESET_DEMO_STATE",
        action_detail=f"Reset to known-good demo state: {nodes_summary['total_nodes']} nodes, {rels_summary['total_edges']} edges."
    )
    
    summary = {
        "status": "success",
        "nodes": {
            "total_nodes": nodes_summary["total_nodes"],
            "persons": nodes_summary["persons"],
            "phones": nodes_summary["phones"],
            "accounts": nodes_summary["accounts"]
        },
        "relationships": {
            "total_edges": rels_summary["total_edges"],
            "called": rels_summary["called"],
            "transfers": rels_summary["transfers"],
            "owns_phone": rels_summary["owns_phone"],
            "owns_account": rels_summary["owns_account"]
        },
        "entity_resolution": {
            "deterministic_merges": er_res.get("deterministic_merges", 0),
            "fuzzy_merges": er_res.get("fuzzy_merges", 0),
            "aliases_unified": er_res.get("aliases_unified", 0)
        },
        "clusters_discovered": len(cluster_res.get("clusters", []))
    }
    
    return summary


if __name__ == "__main__":
    result = reset_to_known_good_demo_state()
    print("\n=======================================================")
    print("DEMO RESET SUMMARY:")
    print(json.dumps(result, indent=2))
    print("=======================================================")
