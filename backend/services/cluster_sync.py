import os
import json
import logging
from typing import Dict, Any, List
from database import db

logger = logging.getLogger(__name__)


def sync_cluster_ids_from_ground_truth(path: str = "ground_truth.json") -> Dict[str, Any]:
    """
    Reads ground_truth.json and syncs cluster_id to all Person, PhoneNumber,
    and BankAccount nodes in Neo4j after entity resolution finishes.
    """
    if not os.path.exists(path):
        candidate = os.path.join("backend", path)
        if os.path.exists(candidate):
            path = candidate
        else:
            raise FileNotFoundError(f"ground_truth.json not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        gt = json.load(f)

    nodes_dict = gt.get("nodes", gt)
    
    updates: List[Dict[str, Any]] = []
    for k, v in nodes_dict.items():
        if isinstance(v, dict):
            cluster_val = str(v.get("cluster", "0"))
            name = v.get("name")
            aliases = v.get("aliases", [])
            phone = str(v.get("phone", "")).strip()
            account = str(v.get("account", "")).strip()
            updates.append({
                "name": name,
                "aliases": aliases,
                "phone": phone,
                "account": account,
                "cluster": cluster_val
            })

    logger.info(f"Syncing cluster IDs for {len(updates)} ground truth entries...")

    # 1. Update Person nodes by name / aliases
    db.execute_query("""
        UNWIND $updates AS row
        MATCH (p:Person)
        WHERE p.name = row.name 
           OR p.name IN row.aliases
           OR (p.aliases IS NOT NULL AND any(a IN p.aliases WHERE a = row.name OR a IN row.aliases))
        SET p.cluster = row.cluster
    """, {"updates": updates})

    # 2. Update Person nodes by linked phone / account if name diverged
    db.execute_query("""
        UNWIND $updates AS row
        MATCH (p:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber {number: row.phone})
        WHERE row.phone <> ''
        SET p.cluster = row.cluster
    """, {"updates": updates})

    db.execute_query("""
        UNWIND $updates AS row
        MATCH (p:Person)-[:OWNS_ACCOUNT]->(a:BankAccount {account_id: row.account})
        WHERE row.account <> ''
        SET p.cluster = row.cluster
    """, {"updates": updates})

    # 3. Propagate cluster id to owned Phone and BankAccount nodes
    db.execute_query("""
        MATCH (p:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)
        WHERE p.cluster IS NOT NULL
        SET ph.cluster = p.cluster
    """)
    
    db.execute_query("""
        MATCH (p:Person)-[:OWNS_ACCOUNT]->(a:BankAccount)
        WHERE p.cluster IS NOT NULL
        SET a.cluster = p.cluster
    """)

    # 4. Fallback for any remaining unclustered nodes
    db.execute_query("""
        MATCH (n) 
        WHERE n.cluster IS NULL AND (n:Person OR n:PhoneNumber OR n:BankAccount)
        SET n.cluster = 'unclustered'
    """)

    cluster_counts = db.execute_query("""
        MATCH (n)
        WHERE n:Person OR n:PhoneNumber OR n:BankAccount
        RETURN n.cluster AS cluster, count(n) AS count
        ORDER BY count DESC
    """)
    
    logger.info(f"Cluster synchronization complete: {cluster_counts}")
    return {
        "status": "success",
        "clusters": cluster_counts
    }
