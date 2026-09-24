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
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
                )
                self.verify_connectivity()
                logger.info("Successfully connected to Neo4j database.")
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

    def get_graph_topology(self, limit: int = 500) -> Dict[str, Any]:
        """
        Fetches all nodes and relationships from Neo4j and formats them
        strictly into Cytoscape.js elements schema: {"elements": {"nodes": [...], "edges": [...]}}
        """
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

        def process_node(node_data: Optional[Dict[str, Any]], labels: Optional[List[str]], eid: Optional[str]) -> Optional[str]:
            if not node_data or not eid:
                return None
            
            node_type = labels[0] if labels and len(labels) > 0 else "Entity"
            
            # Extract distinct primary key / identifier
            if "name" in node_data and node_data["name"]:
                node_id = str(node_data["name"])
                label = str(node_data["name"])
            elif "number" in node_data and node_data["number"]:
                node_id = str(node_data["number"])
                label = str(node_data["number"])
            elif "account_id" in node_data and node_data["account_id"]:
                node_id = str(node_data["account_id"])
                label = str(node_data["account_id"])
            else:
                node_id = str(eid)
                label = str(eid)

            if node_id not in nodes_dict:
                data_payload: Dict[str, Any] = {
                    "id": node_id,
                    "label": label,
                    "type": node_type,
                    "elementId": eid,
                }
                # Attach extra attributes if present
                for k, v in node_data.items():
                    data_payload[k] = v
                
                # Add sublabel
                if node_type == "Person":
                    data_payload["sublabel"] = node_data.get("role", "Suspect")
                elif node_type == "PhoneNumber":
                    data_payload["sublabel"] = node_data.get("carrier", "Carrier Network")
                elif node_type == "BankAccount":
                    data_payload["sublabel"] = node_data.get("bank_name", "Banking Entity")

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
                edge_id = f"edge_{r_eid}"
                if edge_id not in edges_dict:
                    # Formulate clear label
                    if r_type == "CALLED":
                        dur = r_props.get("duration")
                        edge_label = f"CALLED ({dur}s)" if dur else "CALLED"
                    elif r_type == "TRANSFERRED_TO":
                        amt = r_props.get("amount")
                        edge_label = f"₹{int(amt):,}" if amt is not None else "TRANSFERRED"
                    else:
                        edge_label = str(r_type)

                    edge_payload: Dict[str, Any] = {
                        "id": edge_id,
                        "source": source_id,
                        "target": target_id,
                        "label": edge_label,
                        "type": r_type,
                        "elementId": r_eid,
                    }
                    for k, v in r_props.items():
                        edge_payload[k] = v

                    edges_dict[edge_id] = {"data": edge_payload}

        return {
            "elements": {
                "nodes": list(nodes_dict.values()),
                "edges": list(edges_dict.values())
            }
        }


# Global database instance
db = Neo4jDatabase()
