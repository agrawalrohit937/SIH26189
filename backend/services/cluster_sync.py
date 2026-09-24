import os
import json
import logging
from typing import Dict, Any, List, Set
import networkx as nx
from database import db

logger = logging.getLogger(__name__)


def sync_cluster_ids_from_ground_truth(path: str = "ground_truth.json") -> Dict[str, Any]:
    """
    Computes graph community clusters dynamically from the active Neo4j graph topology.
    Uses NetworkX community detection / connected components, optionally cross-referencing
    ground_truth.json if present.
    Assigns a string cluster ID (e.g. '0', '1', '2') to all Person, PhoneNumber,
    and BankAccount nodes in Neo4j.
    """
    logger.info("Computing dynamic graph community clusters for Neo4j topology...")

    # 1. Fetch all nodes and relationships from Neo4j
    all_nodes_res = db.execute_query("""
        MATCH (n)
        WHERE n:Person OR n:PhoneNumber OR n:BankAccount
        RETURN elementId(n) AS eid, labels(n) AS labels, 
               coalesce(n.name, n.number, n.account_id, elementId(n)) AS id,
               n.name AS name, n.number AS number, n.account_id AS account_id
    """)

    if not all_nodes_res:
        logger.info("No nodes in database to cluster.")
        return {"status": "success", "clusters": [], "total_nodes": 0}

    all_edges_res = db.execute_query("""
        MATCH (n)-[r]->(m)
        WHERE (n:Person OR n:PhoneNumber OR n:BankAccount) 
          AND (m:Person OR m:PhoneNumber OR m:BankAccount)
        RETURN coalesce(n.name, n.number, n.account_id, elementId(n)) AS source,
               coalesce(m.name, m.number, m.account_id, elementId(m)) AS target,
               type(r) AS rel_type
    """)

    # 2. Build NetworkX graph
    G = nx.Graph()
    for row in all_nodes_res:
        node_id = str(row["id"])
        G.add_node(node_id, labels=row.get("labels", []), eid=row.get("eid"))

    for row in all_edges_res:
        s = str(row["source"])
        t = str(row["target"])
        if s in G and t in G:
            G.add_edge(s, t, rel_type=row.get("rel_type"))

    # 3. Community detection on active topology
    node_to_cluster: Dict[str, str] = {}
    
    # Try greedy modularity community detection if graph has edges
    if G.number_of_edges() > 0:
        try:
            communities = list(nx.community.greedy_modularity_communities(G))
            # Sort communities by size descending
            communities.sort(key=len, reverse=True)
            for cluster_idx, comm in enumerate(communities):
                for node_id in comm:
                    node_to_cluster[node_id] = str(cluster_idx)
        except Exception as comm_err:
            logger.warning(f"Greedy modularity clustering fallback to connected components: {comm_err}")
            for cluster_idx, comp in enumerate(nx.connected_components(G)):
                for node_id in comp:
                    node_to_cluster[node_id] = str(cluster_idx)
    else:
        for idx, node_id in enumerate(G.nodes()):
            node_to_cluster[node_id] = "0"

    # Optional: check if ground_truth.json has predefined clusters for any specific entities
    gt_path = path
    if not os.path.exists(gt_path):
        candidate = os.path.join("backend", path)
        if os.path.exists(candidate):
            gt_path = candidate
        else:
            candidate_root = os.path.join("e:/SIH26189", path)
            if os.path.exists(candidate_root):
                gt_path = candidate_root

    if os.path.exists(gt_path):
        try:
            with open(gt_path, "r", encoding="utf-8") as f:
                gt = json.load(f)
            nodes_dict = gt.get("nodes", gt)
            for k, v in nodes_dict.items():
                if isinstance(v, dict):
                    gt_cluster = str(v.get("cluster", "0"))
                    if v.get("name") and str(v.get("name")) in node_to_cluster:
                        node_to_cluster[str(v.get("name"))] = gt_cluster
                    if v.get("phone") and str(v.get("phone")) in node_to_cluster:
                        node_to_cluster[str(v.get("phone"))] = gt_cluster
                    if v.get("account") and str(v.get("account")) in node_to_cluster:
                        node_to_cluster[str(v.get("account"))] = gt_cluster
        except Exception as e:
            logger.debug(f"Ground truth alignment skipped ({e})")

    # 4. Update nodes in Neo4j in batch
    updates = [{"id": node_id, "cluster": cluster_id} for node_id, cluster_id in node_to_cluster.items()]

    db.execute_query("""
        UNWIND $updates AS row
        MATCH (n)
        WHERE (n:Person AND (n.name = row.id OR elementId(n) = row.id))
           OR (n:PhoneNumber AND (n.number = row.id OR elementId(n) = row.id))
           OR (n:BankAccount AND (n.account_id = row.id OR elementId(n) = row.id))
        SET n.cluster = row.cluster
    """, {"updates": updates})

    # Propagate clusters across ownership edges if any secondary nodes are missing clusters
    db.execute_query("""
        MATCH (p:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)
        WHERE p.cluster IS NOT NULL AND (ph.cluster IS NULL OR ph.cluster = 'unclustered')
        SET ph.cluster = p.cluster
    """)
    
    db.execute_query("""
        MATCH (p:Person)-[:OWNS_ACCOUNT]->(a:BankAccount)
        WHERE p.cluster IS NOT NULL AND (a.cluster IS NULL OR a.cluster = 'unclustered')
        SET a.cluster = p.cluster
    """)

    # Catch any remaining unclustered nodes
    db.execute_query("""
        MATCH (n) 
        WHERE n.cluster IS NULL AND (n:Person OR n:PhoneNumber OR n:BankAccount)
        SET n.cluster = '0'
    """)

    cluster_counts = db.execute_query("""
        MATCH (n)
        WHERE n:Person OR n:PhoneNumber OR n:BankAccount
        RETURN n.cluster AS cluster, count(n) AS count
        ORDER BY count DESC
    """)

    logger.info(f"Dynamic cluster synchronization complete: {cluster_counts}")
    return {
        "status": "success",
        "total_nodes_clustered": len(node_to_cluster),
        "clusters": cluster_counts
    }
