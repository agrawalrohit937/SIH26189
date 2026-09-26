import logging
from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver
from config import get_settings

logger = logging.getLogger(__name__)


class Neo4jDatabase:
    _instance: Optional["Neo4jDatabase"] = None
    _driver: Optional[Driver] = None

    def __new__(cls) -> "Neo4jDatabase":
        if cls._instance is None:
            cls._instance = super(Neo4jDatabase, cls).__new__(cls)
        return cls._instance

    def connect(self) -> None:
        """Initializes the Neo4j driver and verifies database connectivity."""
        if self._driver is None:
            settings = get_settings()
            try:
                self._driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                    max_connection_lifetime=300,
                    max_connection_pool_size=50,
                    connection_acquisition_timeout=10.0,
                    keep_alive=True
                )
                self.verify_connectivity()
                logger.info("Successfully connected to Neo4j database with pooled driver.")
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j at {settings.NEO4J_URI}: {e}")
                raise e

    def verify_connectivity(self) -> None:
        """Verifies driver connectivity to the Neo4j server."""
        if self._driver:
            self._driver.verify_connectivity()

    def close(self) -> None:
        """Closes the active Neo4j driver connection."""
        if self._driver is not None:
            self._driver.close()
            self._driver = None
            logger.info("Neo4j driver connection closed.")

    def get_driver(self) -> Driver:
        """Returns active Neo4j driver instance or establishes connection."""
        if self._driver is None:
            self.connect()
        return self._driver

    def execute_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes a Cypher query with optional parameters and returns records as list of dicts.
        """
        driver = self.get_driver()
        with driver.session(database=database) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def get_graph_topology(
        self,
        limit: int = 500,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        case_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches nodes and relationships from Neo4j and formats them
        strictly into Cytoscape.js elements schema matching the Criminal Network Graph visualization design.
        Supports case_id isolation filtering and temporal date-range filtering over CALLED and TRANSFERRED_TO edges.
        """
        if case_id and case_id.strip() and case_id.upper() != "ALL":
            query = """
            MATCH (n)
            WHERE n.case_id = $case_id OR $case_id IN n.case_ids OR n.source_fir = $case_id OR toString(n.cluster) = $case_id
            OPTIONAL MATCH (n)-[r]->(m)
            WHERE m.case_id = $case_id OR $case_id IN m.case_ids OR m.source_fir = $case_id OR toString(m.cluster) = $case_id OR r.case_id = $case_id
            RETURN n, labels(n) AS n_labels, elementId(n) AS n_id,
                   r, type(r) AS r_type, properties(r) AS r_props, elementId(r) AS r_id,
                   m, labels(m) AS m_labels, elementId(m) AS m_id
            LIMIT $limit
            """
            records = self.execute_query(query, {"limit": limit, "case_id": case_id})
        else:
            query = """
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN n, labels(n) AS n_labels, elementId(n) AS n_id,
                   r, type(r) AS r_type, properties(r) AS r_props, elementId(r) AS r_id,
                   m, labels(m) AS m_labels, elementId(m) AS m_id
            LIMIT $limit
            """
            records = self.execute_query(query, {"limit": limit})
        
        nodes_dict: Dict[str, Dict[str, Any]] = {}
        edges_dict: Dict[str, Dict[str, Any]] = {}
        node_degrees: Dict[str, int] = {}


        # First pass to compute degrees to identify key central suspect
        for row in records:
            n_node = row.get("n")
            m_node = row.get("m")
            if n_node:
                s_id = str(n_node.get("name") or n_node.get("number") or n_node.get("account_id") or row.get("n_id"))
                node_degrees[s_id] = node_degrees.get(s_id, 0) + 1
            if m_node:
                t_id = str(m_node.get("name") or m_node.get("number") or m_node.get("account_id") or row.get("m_id"))
                node_degrees[t_id] = node_degrees.get(t_id, 0) + 1

        def process_node(node_data: Optional[Dict[str, Any]], labels: Optional[List[str]], eid: Optional[str]) -> Optional[str]:
            if not node_data or not eid:
                return None
            
            node_type = labels[0] if labels and len(labels) > 0 else "Entity"
            
            # Extract primary key and label
            if "name" in node_data and node_data["name"]:
                node_id = str(node_data["name"])
                label = str(node_data["name"])
            elif "number" in node_data and node_data["number"]:
                node_id = str(node_data["number"])
                raw_num = str(node_data["number"])
                label = f"+91 {raw_num}" if len(raw_num) == 10 and not raw_num.startswith("+") else raw_num
            elif "account_id" in node_data and node_data["account_id"]:
                node_id = str(node_data["account_id"])
                bank_pfx = node_data.get("bank_name", "Bank")
                label = f"{bank_pfx} A/c {node_data['account_id']}"
            elif "location" in node_data and node_data["location"]:
                node_id = str(node_data["location"])
                label = str(node_data["location"])
            else:
                node_id = str(eid)
                label = str(eid)

            if node_id not in nodes_dict:
                role = str(node_data.get("role", "")).strip()
                is_lead_role = any(kw in role.lower() for kw in ["lead", "kingpin", "director", "key suspect", "boss", "head"])
                
                data_payload: Dict[str, Any] = {
                    "id": node_id,
                    "label": label,
                    "type": node_type,
                    "elementId": eid,
                    "cluster": str(node_data.get("cluster", "0")),
                    "degree": node_degrees.get(node_id, 1),
                }

                # Attach extra attributes if present
                for k, v in node_data.items():
                    data_payload[k] = v

                # Sublabel and Key Suspect Tagging
                if node_type == "Person":
                    # Mark if key suspect
                    if is_lead_role or (role and "suspect" in role.lower()) or node_degrees.get(node_id, 0) >= 5:
                        data_payload["isKeySuspect"] = True
                        data_payload["sublabel"] = "(Key Suspect)"
                    else:
                        data_payload["isKeySuspect"] = False
                        data_payload["sublabel"] = f"({role})" if role else "(Person)"
                elif node_type == "PhoneNumber":
                    data_payload["sublabel"] = "Phone"
                elif node_type == "BankAccount":
                    data_payload["sublabel"] = "Account"
                elif node_type == "Location":
                    data_payload["sublabel"] = "Location"

                nodes_dict[node_id] = {"data": data_payload}

            return node_id

        for row in records:
            n_node = row.get("n")
            n_labels = row.get("n_labels")
            n_eid = row.get("n_id")
            source_id = process_node(n_node, n_labels, n_eid)

            m_node = row.get("m")
            m_labels = row.get("m_labels")
            m_eid = row.get("m_id")
            target_id = process_node(m_node, m_labels, m_eid)

            r_type = row.get("r_type")
            r_props = row.get("r_props") or {}
            r_eid = row.get("r_id")

            if source_id and target_id and r_type and r_eid:
                # Temporal filtering if dates provided
                if start_date or end_date:
                    edge_time = r_props.get("timestamp") or r_props.get("date")
                    if edge_time and (r_type in ["CALLED", "TRANSFERRED_TO"]):
                        edge_date_str = str(edge_time)[:10]
                        if start_date and edge_date_str < start_date:
                            continue
                        if end_date and edge_date_str > end_date:
                            continue

                edge_id = f"edge_{r_eid}"
                if edge_id not in edges_dict:
                    # User-friendly edge labels
                    if r_type == "CALLED":
                        dur = r_props.get("duration")
                        edge_label = f"calls ({dur}s)" if dur else "calls"
                    elif r_type == "TRANSFERRED_TO":
                        amt = r_props.get("amount")
                        if amt is not None:
                            amt_k = f"₹{int(amt/1000)}k" if amt >= 1000 else f"₹{int(amt)}"
                            edge_label = f"transaction ({amt_k})"
                        else:
                            edge_label = "transaction"
                    elif r_type == "OWNS_PHONE" or r_type == "HAS_PHONE":
                        edge_label = "uses"
                    elif r_type == "OWNS_ACCOUNT":
                        edge_label = "financial link"
                    elif r_type == "ASSOCIATED_WITH":
                        rel = r_props.get("relationship", "known associate")
                        edge_label = str(rel)
                    elif r_type == "SEEN_AT" or r_type == "VISITED":
                        edge_label = "seen at"
                    else:
                        edge_label = str(r_type).lower().replace("_", " ")

                    # Check if smurfing amount
                    amt_val = float(r_props.get("amount") or 0.0)
                    is_smurfing = 49000.0 <= amt_val <= 49999.0


                    edge_payload: Dict[str, Any] = {
                        "id": edge_id,
                        "source": source_id,
                        "target": target_id,
                        "label": edge_label,
                        "type": r_type,
                        "elementId": r_eid,
                        "isSmurfing": is_smurfing,
                    }
                    for k, v in r_props.items():
                        edge_payload[k] = v

                    edges_dict[edge_id] = {"data": edge_payload}

        # If no key suspect was marked explicitly, mark the person with highest degree
        person_nodes = [n for n in nodes_dict.values() if n["data"].get("type") == "Person"]
        if person_nodes and not any(p["data"].get("isKeySuspect") for p in person_nodes):
            highest_degree_person = max(person_nodes, key=lambda p: p["data"].get("degree", 0))
            highest_degree_person["data"]["isKeySuspect"] = True
            highest_degree_person["data"]["sublabel"] = "(Key Suspect)"

        return {
            "elements": {
                "nodes": list(nodes_dict.values()),
                "edges": list(edges_dict.values())
            }
        }

    def get_case_list(self) -> List[Dict[str, Any]]:
        """Returns list of all active cases/dockets present in Neo4j."""
        query = """
        MATCH (n)
        WHERE n.case_id IS NOT NULL OR n.cluster IS NOT NULL OR n.source_fir IS NOT NULL
        WITH coalesce(n.case_id, n.source_fir, 'Syndicate Cell #' + toString(n.cluster)) AS cid,
             count(n) AS node_count,
             collect(distinct labels(n)[0]) AS entity_types
        RETURN cid AS case_id, node_count, entity_types
        ORDER BY node_count DESC
        """
        records = self.execute_query(query)
        if not records:
            res = self.execute_query("MATCH (n) RETURN count(n) AS total")
            total = res[0]["total"] if res else 0
            if total > 0:
                return [{
                    "case_id": "FIR-992/2026",
                    "title": "Primary Case Docket (FIR-992)",
                    "node_count": total
                }]
            return []
        
        cases = []
        for r in records:
            cid = str(r["case_id"])
            cases.append({
                "case_id": cid,
                "title": f"Case: {cid}",
                "node_count": r["node_count"],
                "types": r.get("entity_types", [])
            })
        return cases

    def delete_case(self, case_id: str) -> int:
        """Deletes only nodes and relationships belonging to a specific case without affecting other cases."""
        count_q = """
        MATCH (n)
        WHERE n.case_id = $case_id OR $case_id IN n.case_ids OR n.source_fir = $case_id OR toString(n.cluster) = $case_id
        RETURN count(n) AS c
        """
        res = self.execute_query(count_q, {"case_id": case_id})
        count = res[0]["c"] if res else 0

        delete_q = """
        MATCH (n)
        WHERE n.case_id = $case_id OR $case_id IN n.case_ids OR n.source_fir = $case_id OR toString(n.cluster) = $case_id
        DETACH DELETE n
        """
        self.execute_query(delete_q, {"case_id": case_id})
        return count


# Global database instance
db = Neo4jDatabase()

def run_query(query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Helper alias function to execute Cypher queries on the global Neo4j database instance."""
    return db.execute_query(query, parameters)

