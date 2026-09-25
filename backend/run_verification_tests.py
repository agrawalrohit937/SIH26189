import json
import urllib.request
import urllib.error
from neo4j import GraphDatabase
import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import get_settings

settings = get_settings()

NEO4J_URI = settings.NEO4J_URI
NEO4J_USER = settings.NEO4J_USERNAME
NEO4J_PASSWORD = settings.NEO4J_PASSWORD
API_BASE = "http://localhost:8000/api/v1"

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

def http_get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        body = response.read().decode('utf-8')
        return status_code, json.loads(body)

def http_post(url, data=None):
    payload = json.dumps(data).encode('utf-8') if data else b""
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        body = response.read().decode('utf-8')
        return status_code, json.loads(body)

def http_delete(url):
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        body = response.read().decode('utf-8')
        return status_code, json.loads(body)

def run_step2_audit_verify():
    print("=== STEP 2: AUDIT LOG VERIFICATION ===")
    status, data = http_get(f"{API_BASE}/audit/verify")
    print(f"Status Code: {status}")
    print("Raw JSON Response:")
    print(json.dumps(data, indent=2))
    print()

def run_step3_entity_resolution_test():
    print("=== STEP 3: ENTITY RESOLUTION ACCEPTANCE TEST (YAHVI KALA) ===")
    with driver.session() as session:
        # Clear test specific data
        session.run("MATCH (p:Person) WHERE p.name CONTAINS 'Kala' OR p.name CONTAINS 'Yahvi' OR p.id IN ['test_p1', 'test_p2', 'test_p3'] DETACH DELETE p")
        session.run("MATCH (ph:PhoneNumber) WHERE ph.number = '+919999900001' DETACH DELETE ph")
        
        # Create 3 Person nodes with shared phone
        session.run("""
            CREATE (p1:Person {id: 'test_p1', name: 'Yahvi Kala', created_at: '2026-09-25T00:00:00Z'})
            CREATE (p2:Person {id: 'test_p2', name: 'Y. Kala', created_at: '2026-09-25T00:00:00Z'})
            CREATE (p3:Person {id: 'test_p3', name: 'Yahvi K.', created_at: '2026-09-25T00:00:00Z'})
            CREATE (ph:PhoneNumber {number: '+919999900001'})
            CREATE (p1)-[:OWNS_PHONE]->(ph)
            CREATE (p2)-[:OWNS_PHONE]->(ph)
            CREATE (p3)-[:OWNS_PHONE]->(ph)
        """)
    
    # Run entity resolution via API
    status, res_data = http_post(f"{API_BASE}/intelligence/resolve-entities")
    print(f"Resolution API Status: {status}, Response: {json.dumps(res_data, indent=2)}")
    
    # Query Neo4j for Kala nodes
    with driver.session() as session:
        result = session.run("""
            MATCH (p:Person)
            WHERE p.name CONTAINS 'Kala' OR (p.aliases IS NOT NULL AND any(a IN p.aliases WHERE a CONTAINS 'Kala'))
            RETURN p.name AS name, p.aliases AS aliases, p.id AS id
        """)
        records = [dict(r) for r in result]
        print("Cypher Query: MATCH (p:Person) WHERE p.name CONTAINS 'Kala' OR (p.aliases IS NOT NULL AND any(a IN p.aliases WHERE a CONTAINS 'Kala')) RETURN p.name, p.aliases")
        print(f"Nodes Found: {len(records)}")
        print("Raw Records:")
        print(json.dumps(records, indent=2))
        print()

def run_step4_smurfing_test():
    print("=== STEP 4: SMURFING / STRUCTURING TEST (4x ₹49,500) ===")
    with driver.session() as session:
        # Clear specific accounts
        session.run("MATCH (b:BankAccount) WHERE b.account_id IN ['ACC_SMURF_SRC', 'ACC_SMURF_DST'] DETACH DELETE b")
        session.run("MATCH (p:Person) WHERE p.id IN ['smurf_p1', 'smurf_p2'] DETACH DELETE p")
        
        # Insert 4 transactions of exactly 49,500 between same two accounts within 2 days
        session.run("""
            CREATE (p1:Person {id: 'smurf_p1', name: 'Sender Mule'})
            CREATE (p2:Person {id: 'smurf_p2', name: 'Receiver Handler'})
            CREATE (acc1:BankAccount {account_id: 'ACC_SMURF_SRC', bank_name: 'State Bank of India', ifsc: 'SBIN0001'})
            CREATE (acc2:BankAccount {account_id: 'ACC_SMURF_DST', bank_name: 'HDFC Bank', ifsc: 'HDFC0001'})
            CREATE (p1)-[:OWNS_ACCOUNT]->(acc1)
            CREATE (p2)-[:OWNS_ACCOUNT]->(acc2)
            CREATE (acc1)-[:TRANSFERRED_TO {transaction_id: 'TX_S1', amount: 49500.0, date: '2026-09-20', remarks: 'Consulting'}]->(acc2)
            CREATE (acc1)-[:TRANSFERRED_TO {transaction_id: 'TX_S2', amount: 49500.0, date: '2026-09-20', remarks: 'Services'}]->(acc2)
            CREATE (acc1)-[:TRANSFERRED_TO {transaction_id: 'TX_S3', amount: 49500.0, date: '2026-09-21', remarks: 'Advance'}]->(acc2)
            CREATE (acc1)-[:TRANSFERRED_TO {transaction_id: 'TX_S4', amount: 49500.0, date: '2026-09-21', remarks: 'Final Settlement'}]->(acc2)
        """)

    # Call GET /api/v1/alerts/financial
    status, alerts = http_get(f"{API_BASE}/alerts/financial")
    print(f"Status Code: {status}")
    print("Raw Alerts JSON Response:")
    print(json.dumps(alerts, indent=2))
    print()

def run_step5_purge_test():
    print("=== STEP 5: PURGE DATABASE VERIFICATION ===")
    status, res_data = http_delete(f"{API_BASE}/admin/clear-db")
    print(f"DELETE /api/v1/admin/clear-db Status: {status}")
    print(f"Response: {json.dumps(res_data, indent=2)}")
    
    # Check directly in Neo4j
    with driver.session() as session:
        result = session.run("MATCH (n) RETURN count(n) AS c")
        count = result.single()["c"]
        print("Direct Neo4j Query: MATCH (n) RETURN count(n) AS c")
        print(f"Actual Node Count in Neo4j: {count}")
    print()

if __name__ == "__main__":
    run_step2_audit_verify()
    run_step3_entity_resolution_test()
    run_step4_smurfing_test()
    run_step5_purge_test()
