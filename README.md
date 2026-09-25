# 🛡️ National Crime Intelligence Grid (SIH26189)
### AI-Powered Criminal Network & Money Laundering Analysis System
**Ministry of Home Affairs (MHA) • Smart India Hackathon 2026**  
**Theme:** Blockchain & Cybersecurity / Artificial Intelligence

---

## 📌 Executive Summary
The **National Crime Intelligence Grid** is a high-throughput, AI-driven criminal intelligence platform designed for law enforcement agencies to uncover hidden syndicate structures, detect money-mule smurfing patterns, track telecom burner cycling, and generate court-ready officer briefing dossiers.

---

## ⚡ Quickstart Setup Guide (Zero-Configuration Clean Run)

### Prerequisites
- **Python 3.10+** (Tested on Python 3.10, 3.12, 3.14)
- **Node.js 18+ / 20+**
- **Neo4j Aura Instance or Local Neo4j 5.x+**

---

### 1. Backend Service Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI Uvicorn dev server
uvicorn main:app --reload --port 8000
```
*Backend runs on `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.*

---

### 2. Frontend Dashboard Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```
*Frontend interface is live at `http://localhost:3000`.*

---

## 🔑 Demo Role Credentials (RBAC Quick Reference)

| Role | Demo Username | Password | Privileges & PII Policy |
| :--- | :--- | :--- | :--- |
| **Field Investigator** | `investigator` | `investigator123` | **Masked PII** (`+91-XXXXX-9522`, `ACC-XXXX-9032`), Read-Only, Case Purge Blocked (`HTTP 403`) |
| **Case Supervisor** | `supervisor` | `supervisor123` | **Unmasked PII**, GAT Link Confirmation, Officer Briefing Dossier Generation |
| **Lead Admin** | `admin` | `admin123` | **Full Access**, System Audit Log Verification, Database Purge (`HTTP 200`) |

---

## 🧪 Automated Acceptance Test Suite

Run the full automated test suite verifying all 11 critical acceptance criteria:
```bash
# Run pytest from repository root with backend venv active
pytest backend/tests/test_acceptance.py -v
```

---

## 🏛️ System Architecture & Highlights
- **Deterministic & Phonetic Entity Resolution:** 3-tier resolution algorithm prioritizing shared Phone/Account identifiers followed by Soundex blocking.
- **Graph Attention Network (GAT):** 2-layer GAT for link prediction with attention justification weights and human-in-the-loop active learning feedback (`POST /api/v1/intelligence/feedback`).
- **Cryptographic Audit Hash Chain:** SHA-256 tamper-evident immutable ledger logging every ingestion, search query, copilot chat, and purge operation with 64-character hash invariants.
- **Unified Open-Weight LLM:** Single efficient open-weight model (`openai/gpt-oss-20b` via Groq) powering FIR entity extraction, Graph-RAG Copilot, and Officer Dossier synthesis with low latency.
- **Institutional Frontend:** Light-theme command center with interactive Cytoscape topology, pastel Louvain community hulls, crimson bridge styling, Leaflet GIS mapping, and date-range temporal scrubber.
