import os
import sys
from database import db
from schema import enforce_schema, SCHEMA_STATEMENTS
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.nlp_extraction import process_fir_text
from services.graph_intelligence import detect_smurfing_patterns

def step1_wipe():
    print("Executing Step 1: Wiping Neo4j database...")
    db.connect()
    db.execute_query("MATCH (n) DETACH DELETE n;")
    count = db.execute_query("MATCH (n) RETURN count(n) AS total")[0]["total"]
    print(f"Graph wiped. Remaining node count: {count}")

def step2_constraints():
    print("Executing Step 2: Adding constraints and indexes...")
    enforce_schema()
    # verify constraints
    constraints = db.execute_query("SHOW CONSTRAINTS")
    print(f"Total constraints active: {len(constraints)}")
    for c in constraints:
        print(f" - {c.get('name')}: {c.get('type')} on {c.get('labelsOrTypes')}")

def step3_and_4_reingest():
    print("Executing Step 3 & 4: Ingesting CDR, Bank Transactions, and FIR...")
    cdr_res = ingest_cdr_data()
    print("CDR Ingestion:", cdr_res)
    bank_res = ingest_bank_data()
    print("Bank Ingestion:", bank_res)
    fir_res = process_fir_text()
    print("FIR Ingestion:", fir_res)

    print("\n--- Distinct Node Counts Verification ---")
    persons = db.execute_query("MATCH (p:Person) RETURN count(p) AS count")[0]["count"]
    accounts = db.execute_query("MATCH (a:BankAccount) RETURN count(a) AS count")[0]["count"]
    phones = db.execute_query("MATCH (n:PhoneNumber) RETURN count(n) AS count")[0]["count"]
    print(f"Distinct Person nodes: {persons}")
    print(f"Distinct BankAccount nodes: {accounts}")
    print(f"Distinct PhoneNumber nodes: {phones}")

def step5_verify_smurfing():
    print("\nExecuting Step 5: Testing Smurfing Evasion Detection...")
    alerts = detect_smurfing_patterns()
    print(f"Total Alerts returned: {len(alerts)}")
    for idx, a in enumerate(alerts, 1):
        print(f"\nAlert #{idx}:")
        print(f" Sender: {a['sender_name']} ({a['sender_account']})")
        print(f" Receiver: {a['receiver_name']} ({a['receiver_account']})")
        print(f" Transaction Count: {a['transaction_count']}")
        print(f" Span Days: {a['span_days']}")
        print(f" Total Evaded Amount: INR {a['total_evaded_amount']:,.2f}")
        print(f" Description: {str(a.get('alert_description', '')).replace('₹', 'INR ')}")

def step6_check_bridging():
    print("\nExecuting Step 6: Verifying Person-to-Phone and Person-to-Account Bridging Edges...")
    bridged = db.execute_query("""
    MATCH (p:Person)-[r:OWNS_PHONE|OWNS_ACCOUNT]->(x)
    RETURN p.name AS person, type(r) AS rel_type, labels(x)[0] AS target_type, count(x) AS link_count
    """)
    for b in bridged:
        print(f" - Person '{b['person']}' -[:{b['rel_type']}]-> ({b['target_type']}) [Count: {b['link_count']}]")

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "all"
    if action == "wipe":
        step1_wipe()
    elif action == "constraints":
        step2_constraints()
    elif action == "ingest":
        step3_and_4_reingest()
    elif action == "smurfing":
        step5_verify_smurfing()
    elif action == "bridging":
        step6_check_bridging()
    elif action == "all":
        step1_wipe()
        step2_constraints()
        step3_and_4_reingest()
        step5_verify_smurfing()
        step6_check_bridging()
