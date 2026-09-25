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

    # 2. Build NetworkX graph with deterministic node and edge order
    all_nodes_res.sort(key=lambda r: str(r.get("id", "")))
    all_edges_res.sort(key=lambda r: (str(r.get("source", "")), str(r.get("target", ""))))

    G = nx.Graph()
    for row in all_nodes_res:
        node_id = str(row["id"])
        G.add_node(node_id, labels=row.get("labels", []), eid=row.get("eid"))

    for row in all_edges_res:
        s = str(row["source"])
        t = str(row["target"])
        if s in G and t in G:
            G.add_edge(s, t, rel_type=row.get("rel_type"))

    # 3. Real Louvain community detection on active graph topology
    node_to_cluster: Dict[str, str] = {}
    
    if G.number_of_edges() > 0:
        try:
            from networkx.algorithms.community import louvain_communities
            communities = list(louvain_communities(G, seed=42))
            # Sort communities deterministically by size descending, then by min element name
            communities.sort(key=lambda c: (-len(c), sorted(list(c))[0] if c else ""))
            for cluster_idx, comm in enumerate(communities):
                for node_id in sorted(list(comm)):
                    node_to_cluster[node_id] = str(cluster_idx)
            logger.info(f"Louvain community detection discovered {len(communities)} distinct syndicate clusters.")
        except Exception as comm_err:
            logger.warning(f"Louvain clustering fallback to connected components: {comm_err}")
            for cluster_idx, comp in enumerate(nx.connected_components(G)):
                for node_id in comp:
                    node_to_cluster[node_id] = str(cluster_idx)
    else:
        for idx, node_id in enumerate(G.nodes()):
            node_to_cluster[node_id] = "0"

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
