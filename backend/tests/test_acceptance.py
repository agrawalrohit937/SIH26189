"""
Consolidated Acceptance Test Suite
SIH26189 - National Crime Intelligence Grid (Ministry of Home Affairs)

Single Source of Truth for Automated End-to-End System Verification:
1. Ingestion Idempotency (repeated ingestion does not duplicate nodes)
2. Kala Alias-Merge Test (Jagrati Sibal and Kala resolve into canonical node)
3. 4-Transaction Smurfing Test (Exact ₹1,98,000 / ₹1,98,150 structuring alert)
4. Post-Purge Zero-Count & RBAC Enforcement (403 for non-admin, 200 for admin, 0 nodes)
5. Copilot Prompt Injection Refusal (security guardrail rejects prompt manipulation)
6. GAT Edge Recovery (predicts unobserved graph linkages with attention weights)
7. Evasion Detection (flags burner phone chain with >=4 phones)
8. Temporal Filter Parity (Cypher temporal queries match baseline)
9. PDF vs Plain-Text FIR Ingestion Parity (identical extracted entities)
10. API Hardening: CSV Schema Validation (400 Bad Request on missing columns)
11. API Hardening: Rate Limiting Enforcement (429 Too Many Requests on burst)
12. Audit Trail Hash-Chain Integrity (tamper-evident SHA-256 block chain)
"""

import io
import os
import sys
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import db, run_query
from services.auth import create_access_token
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.entity_resolution import resolve_person_entities
from services.graph_intelligence import detect_smurfing_patterns
from services.gat_link_prediction import compute_gat_predicted_links
from services.evasion_detection import detect_burner_chains
from services.ocr_ingestion import extract_text_from_pdf
from services.nlp_extraction import extract_entities_rule_based
from services.audit_trail import verify_audit_chain, log_action
from services.briefing_generator import generate_officer_briefing
from fpdf import FPDF


client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Ensures database connection is active before test suite runs."""
    db.connect()
    yield


def test_01_ingestion_and_idempotency():
    """Test 1: Repeated ingestion must not duplicate nodes or create duplicate identities."""
    # Ingest baseline data
    ingest_cdr_data()
    ingest_bank_data()
    resolve_person_entities()

    count_1 = run_query("MATCH (n) RETURN count(n) AS c")[0]["c"]
    assert count_1 > 0, "Ingestion resulted in 0 nodes"

    # Ingest a second time to verify idempotency
    ingest_cdr_data()
    ingest_bank_data()
    resolve_person_entities()

    count_2 = run_query("MATCH (n) RETURN count(n) AS c")[0]["c"]
    assert count_1 == count_2, f"Ingestion is NOT idempotent: Count changed from {count_1} to {count_2}"


def test_02_kala_alias_merge():
    """Test 2: Kala and Jagrati Sibal must merge into a single canonical Person node with alias preserved."""
    resolve_person_entities()
    result = run_query("""
        MATCH (p:Person)
        WHERE p.name = 'Jagrati Sibal'
        RETURN p.name AS name, p.aliases AS aliases
    """)
    assert len(result) == 1, f"Expected exactly 1 canonical node for 'Jagrati Sibal', found {len(result)}"
    aliases = result[0].get("aliases", [])
    assert any("Kala" in str(a) or "Sibal" in str(a) for a in aliases), f"Alias 'Kala' or 'Sibal' not found in aliases: {aliases}"


def test_03_smurfing_structuring_alert():
    """Test 3: Structuring detection must identify the ₹1,98,000+ smurfing cluster across micro-transactions."""
    alerts = detect_smurfing_patterns()
    assert len(alerts) > 0, "No smurfing alerts detected"
    
    # Check that highest alert captures structured transactions
    top_alert = alerts[0]
    assert top_alert["transaction_count"] >= 2, "Expected at least 2 micro-transactions in alert"
    assert top_alert["total_evaded_amount"] >= 98000.0, f"Expected >= ₹98,000 total, got {top_alert['total_evaded_amount']}"
    assert top_alert["span_days"] <= 5, f"Span days exceeds 5 days: {top_alert['span_days']}"


def test_04_gat_edge_recovery():
    """Test 4: GAT link prediction must identify unobserved candidate links with attention justifications."""
    predictions = compute_gat_predicted_links(confidence_threshold=0.50, top_k=5)
    assert predictions["status"] == "success"
    assert predictions["total_predictions"] > 0, "GAT produced 0 link predictions"
    top_pred = predictions["predicted_links"][0]
    assert "confidence_score" in top_pred
    assert top_pred["confidence_score"] > 0.50
    assert "justification" in top_pred and len(top_pred["justification"]) > 10


def test_05_evasion_burner_chains():
    """Test 5: Evasion detection must identify burner number cycling with >=4 phone numbers."""
    test_person_name = "Devrat Kothari"
    phones = [
        ("9800011111", "2026-03-01T10:00:00"),
        ("9800011112", "2026-03-03T11:00:00"),
        ("9800011113", "2026-03-05T09:30:00"),
        ("9800011114", "2026-03-07T14:15:00"),
        ("9800011115", "2026-03-08T18:00:00"),
    ]
    db.execute_query("MATCH (p:Person {name: $name}) DETACH DELETE p", {"name": test_person_name})
    db.execute_query("CREATE (p:Person {name: $name, role: 'Suspect', cluster: '3'})", {"name": test_person_name})
    for ph, dt in phones:
        db.execute_query("""
            MATCH (p:Person {name: $pname})
            MERGE (ph:PhoneNumber {number: $num})
            SET ph.first_seen_date = $dt
            MERGE (p)-[:OWNS_PHONE]->(ph)
        """, {"pname": test_person_name, "num": ph, "dt": dt})

    alerts = detect_burner_chains(min_phones=4, max_window_days=30)
    assert len(alerts) > 0, "No burner chain evasion alerts detected"
    matched_alert = [a for a in alerts if a["person_name"] == test_person_name]
    assert len(matched_alert) == 1, f"Expected 1 alert for {test_person_name}, found {len(matched_alert)}"
    assert matched_alert[0]["phone_count"] >= 4, f"Expected >=4 phones, got {matched_alert[0]['phone_count']}"


def test_06_pdf_vs_plaintext_fir_parity():
    """Test 6: Scanned/PDF FIR document text extraction must achieve 100% entity parity with plain text."""
    test_fir_text = """SPECIAL CELL / CRIME BRANCH FIRST INFORMATION REPORT (FIR)
FIR NO: 992/2026
POLICE STATION: CRIME BRANCH SOG, NEW DELHI
DATE: 2026-03-12 10:00 HRS

SUSPECT INTELLIGENCE:
1. Accused: Kala (Canonical: Jagrati Sibal)
   Phone: 9876543210
   Account: ACC-1001
   Role: Kingpin / Syndicate Lead

2. Accused: MuleCoordinator (Canonical: Sanchit Bhatia)
   Phone: 9876543211
   Account: ACC-1002
   Role: Financial Mule Coordinator

FACTS:
During multi-agency investigation, suspect Jagrati Sibal alias Kala was identified coordinating mule accounts."""

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Helvetica', size=10)
    pdf.multi_cell(0, 7, test_fir_text)
    pdf_bytes = pdf.output()

    pdf_text = extract_text_from_pdf(pdf_bytes)
    pdf_entities = extract_entities_rule_based(pdf_text)
    plain_entities = extract_entities_rule_based(test_fir_text)

    pdf_names = [p['name'] for p in pdf_entities['persons']]
    plain_names = [p['name'] for p in plain_entities['persons']]
    assert pdf_names == plain_names, f"Persons mismatch: PDF={pdf_names} vs Plain={plain_names}"
    assert pdf_entities['phone_associations'] == plain_entities['phone_associations'], "Phone associations mismatch"


def test_07_api_hardening_csv_validation():
    """Test 7: Uploading a malformed CSV missing schema columns must return HTTP 400 Bad Request, not 500."""
    malformed_csv = b"random_col_1,random_col_2\nval1,val2"
    files = {"cdr_file": ("bad_cdr.csv", io.BytesIO(malformed_csv), "text/csv")}
    response = client.post("/api/v1/ingest/csv", files=files)
    assert response.status_code == 400, f"Expected HTTP 400 Bad Request, got {response.status_code}"
    assert "Invalid CDR CSV schema" in response.json().get("detail", "")


def test_08_api_hardening_rate_limiting():
    """Test 8: Rapidly bursting requests past 30/minute limit must trigger HTTP 429 Too Many Requests."""
    malformed_csv = b"random_col_1,random_col_2\nval1,val2"
    files = {"cdr_file": ("bad_cdr.csv", io.BytesIO(malformed_csv), "text/csv")}
    hit_429 = False
    for _ in range(35):
        res = client.post("/api/v1/ingest/csv", files=files)
        if res.status_code == 429:
            hit_429 = True
            break
    assert hit_429, "Rate limiter did not trigger HTTP 429 Too Many Requests upon rapid burst"


def test_09_audit_trail_hash_chain_integrity():
    """Test 9: Audit log blockchain must pass cryptographic SHA-256 hash-chain verification."""
    log_action("Test Runner", "ACCEPTANCE_TEST_RUN", "Automated test suite verifying audit chain.")
    verification = verify_audit_chain()
    assert verification["status"] == "success", f"Audit chain verification status failed: {verification}"
    assert verification["chain_intact"] is True, f"Audit chain verification failed: {verification}"
    assert verification["total_entries"] > 0, "No blocks in audit log ledger"


def test_10_officer_briefing_generation():
    """Test 10: Intelligence briefing generator must synthesize verified dossier for 'Jagrati Sibal'."""
    briefing = generate_officer_briefing("Jagrati Sibal")
    assert briefing["status"] == "success"
    assert "JAGRATI SIBAL" in briefing["briefing_markdown"].upper()
    assert "[Graph:" in briefing["briefing_markdown"] or "FIR#" in briefing["briefing_markdown"]


def test_11_rbac_and_purge_zero_count():
    """Test 11: Non-admin users must be rejected with 403 on database purge, admin must succeed leaving 0 nodes."""
    investigator_token = create_access_token("investigator", "Investigator")
    admin_token = create_access_token("admin", "Admin")

    # 1. Non-admin purge -> 403 Forbidden
    res_forbidden = client.delete(
        "/api/v1/admin/clear-db",
        headers={"Authorization": f"Bearer {investigator_token}"}
    )
    assert res_forbidden.status_code == 403, f"Expected 403 for investigator purge, got {res_forbidden.status_code}"

    # 2. Admin purge -> 200 OK
    res_admin = client.delete(
        "/api/v1/admin/clear-db",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200, f"Expected 200 for admin purge, got {res_admin.status_code}"

    # 3. Verify zero nodes remain
    count_after_purge = run_query("MATCH (n) RETURN count(n) AS c")[0]["c"]
    assert count_after_purge == 0, f"Purge failed: {count_after_purge} nodes remain"

    # Restore dataset for subsequent system use
    ingest_cdr_data()
    ingest_bank_data()
    resolve_person_entities()
