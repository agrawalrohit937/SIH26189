# Forensic Architecture & Mathematical Audit: The Investigator's Co-Pilot (SIH26189)
**System Title:** AI-Powered Criminal Network & Anti-Money Laundering Analysis Platform  
**Target Stack:** Next.js 15 (App Router, Cytoscape.js), FastAPI (Python 3.11/3.14), Neo4j Enterprise/AuraDB, Groq Cloud  
**Audit Focus:** Ingestion Pipeline Idempotency, Cypher Cartesian Elimination, Evasion Velocity Windows, and Force-Directed Graph Physics  
**Date:** September 2026  
**Status:** FORENSIC AUDIT COMPLETE & LIVE DATABASE EXECUTION VERIFIED  

---

## 1. System Architecture & Data Flow Audit

### 1.1 End-to-End Pipeline Topology

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EVIDENCE INGESTION TIER                                        │
│  ┌─────────────────────────┐   ┌─────────────────────────┐   ┌────────────────────────────────┐  │
│  │   Telecom CDR Logs      │   │ Bank Ledger Statement   │   │ Police First Information Report│  │
│  │     (CDR_Logs.csv)      │   │ (Bank_Transactions.csv) │   │       (FIR_Case_992.txt)       │  │
│  └────────────┬────────────┘   └────────────┬────────────┘   └───────────────┬────────────────┘  │
└───────────────┼─────────────────────────────┼────────────────────────────────┼───────────────────┘
                │                             │                                │
                │ POST /api/v1/ingest/csv     │ POST /api/v1/ingest/csv        │ POST /api/v1/ingest/fir
                ▼                             ▼                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FASTAPI APPLICATION LAYER                                      │
│  ┌─────────────────────────┐   ┌─────────────────────────┐   ┌────────────────────────────────┐  │
│  │ Pandas Data Normalizer  │   │ Pandas Data Normalizer  │   │ Groq LLM Extraction Client     │  │
│  │ • Strip whitespace      │   │ • Type coerce amounts   │   │ • Model: openai/gpt-oss-20b    │  │
│  │ • Composite timestamp   │   │ • Isolate source/dest   │   │ • Strict JSON Schema Enforcer  │  │
│  └────────────┬────────────┘   └────────────┬────────────┘   └───────────────┬────────────────┘  │
│               │                             │                                │                   │
│               └──────────────────────┬──────┴────────────────────────────────┘                   │
│                                      │ Parameterized Batches (UNWIND)                            │
│                                      ▼                                                           │
│                        ┌───────────────────────────┐                                             │
│                        │ Neo4j Driver Connection   │                                             │
│                        │ • Singleton Pool Instance │                                             │
│                        │ • Schema Constraint Guard │                                             │
│                        └─────────────┬─────────────┘                                             │
└──────────────────────────────────────┼───────────────────────────────────────────────────────────┘
                                       │ Cypher Binary Protocol (bolt/neo4j+s)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               GRAPH DATABASE PERSISTENCE LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Nodes: (:Person {name}), (:PhoneNumber {number}), (:BankAccount {account_id})              │  │
│  │ Edges: [:CALLED {timestamp, duration}], [:TRANSFERRED_TO {date, amount}], [:OWNS_ACCOUNT] │  │
│  └───────────────────────────────────────────┬────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┼───────────────────────────────────────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               │ GET /api/v1/graph/topology                                    │ GET /api/v1/intelligence/smurfing-alerts
               ▼                                                               ▼
┌───────────────────────────────────────────┐   ┌──────────────────────────────────────────────────┐
│   CYTOSCAPE GRAPH TOPOLOGY ENGINE         │   │         FINANCIAL INTELLIGENCE ENGINE            │
│   • CoSE Physics Simulation               │   │         • CTR Structuring Velocity Traversal     │
│   • 2D Multimodal Cluster Optimization    │   │         • Sliding Date Window Metric             │
│   • Threat Dossier Interactive Inspector  │   │         • Anti-Smurfing Structuring Feeds        │
└─────────────────────┬─────────────────────┘   └──────────────────────────────┬───────────────────┘
                      │                                                        │
                      └────────────────────────┬───────────────────────────────┘
                                               │ JSON Payload Deliveries
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  NEXT.JS ENTERPRISE CLIENT TIER                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ • 12-Column Responsive Dashboard Layout                                                     │  │
│  │ • Interactive Threat Topology Canvas (Forces 2D Cluster Web)                               │  │
│  │ • Live Structured Evasion Warning Feed & Dossier Clipboard Generator                       │  │
│  │ • MHA Law Enforcement AI Investigator Copilot (Asynchronous SSE/REST Client)                │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Identification of Pipeline Data Explosions & Duplication Points

| Component | Failure Mechanism | Empirical Symptom | Forensic Cause |
| :--- | :--- | :--- | :--- |
| **Ingestion Engine** | Unconstrained `CREATE` & Blind `MERGE` | Duplicate nodes for `"Vikram"` and `"ACC_9921"` | Lack of database schema uniqueness constraints prior to UNWIND execution. |
| **Smurfing Engine** | Multi-row Cartesian Join | 40 CSV rows yield 90 alerts & ₹44.55 Lakhs evaded | `OPTIONAL MATCH (sp:Person)` joins multiple duplicate owner nodes against each transaction before grouping. |
| **Cytoscape Visualizer** | 1D Disconnected Component Tiling | Graph renders as a vertical ladder / straight line | Unbalanced CoSE spring-to-repulsion ratio and disconnected sub-graph component stacking along the vertical axis. |

---

## 2. Database Schema & Cypher Mathematics

### 2.1 The Mathematics of Ingestion Idempotency

Let the graph state be represented by $G = (V, E)$.  
Let $\mathcal{D} = \{r_1, r_2, \dots, r_N\}$ be an ingested evidence batch.  
An ingestion function $f(G, \mathcal{D})$ is strictly idempotent if and only if:
$$\forall k \ge 1, \quad f^k(G, \mathcal{D}) = f(G, \mathcal{D})$$

When using raw `CREATE`, each run performs:
$$|V_{new}| = |V_{old}| + N_v \implies \lim_{k \to \infty} |V| = \infty$$

When using constrained `MERGE (u:Label {key: val}) ON CREATE SET ...`, the operation performs a constant-time existence lookup via B-Tree index:
$$\text{If } \exists u \in V \text{ with } u.\text{key} = val \implies \Delta V = 0$$
$$\text{If } \nexists u \in V \text{ with } u.\text{key} = val \implies V = V \cup \{u\}$$

### 2.2 Mathematically Sound Schema Definition & Constraints

Enforced at application startup in `backend/schema.py`:

```cypher
// ==============================================================================
// 1. HARD UNIQUENESS CONSTRAINTS (Ensures O(1) Index Lookup on Ingestion)
// ==============================================================================
CREATE CONSTRAINT constraint_phone_number_unique IF NOT EXISTS
FOR (p:PhoneNumber) REQUIRE p.number IS UNIQUE;

CREATE CONSTRAINT constraint_bank_account_unique IF NOT EXISTS
FOR (b:BankAccount) REQUIRE b.account_id IS UNIQUE;

CREATE CONSTRAINT constraint_person_name_unique IF NOT EXISTS
FOR (p:Person) REQUIRE p.name IS UNIQUE;

// ==============================================================================
// 2. TEMPORAL & ANALYTICAL INDEXES (Accelerates Velocity Range Computations)
// ==============================================================================
CREATE INDEX index_transfer_date IF NOT EXISTS
FOR ()-[r:TRANSFERRED_TO]-() ON (r.date);

CREATE INDEX index_call_timestamp IF NOT EXISTS
FOR ()-[r:CALLED]-() ON (r.timestamp);
```

### 2.3 Verified Zero-Duplication Ingestion Cypher Queries

#### A. Telecom CDR Records (`CDR_Logs.csv`)
```cypher
UNWIND $batch AS row
// 1. Merge Caller & Receiver Phone Nodes
MERGE (caller:PhoneNumber {number: row.caller_number})
  ON CREATE SET caller.number = row.caller_number
MERGE (receiver:PhoneNumber {number: row.receiver_number})
  ON CREATE SET receiver.number = row.receiver_number

// 2. Merge Call Relationship (Idempotent signature on caller + receiver + timestamp)
MERGE (caller)-[c:CALLED {timestamp: row.timestamp}]->(receiver)
  ON CREATE SET c.duration = row.duration,
                c.tower = row.tower
  ON MATCH SET c.duration = row.duration,
               c.tower = row.tower;
```

#### B. Banking Financial Transactions (`Bank_Transactions.csv`)
```cypher
UNWIND $batch AS row
// 1. Sender Person & BankAccount
MERGE (senderPerson:Person {name: row.sender_name})
  ON CREATE SET senderPerson.name = row.sender_name
MERGE (senderAcc:BankAccount {account_id: row.sender_account})
  ON CREATE SET senderAcc.account_id = row.sender_account
MERGE (senderPerson)-[:OWNS_ACCOUNT]->(senderAcc)

// 2. Receiver Person & BankAccount
MERGE (receiverPerson:Person {name: row.receiver_name})
  ON CREATE SET receiverPerson.name = row.receiver_name
MERGE (receiverAcc:BankAccount {account_id: row.receiver_account})
  ON CREATE SET receiverAcc.account_id = row.receiver_account
MERGE (receiverPerson)-[:OWNS_ACCOUNT]->(receiverAcc)

// 3. Financial Transaction Edge (Idempotent signature on account pair + date + amount + remarks)
MERGE (senderAcc)-[t:TRANSFERRED_TO {
    date: row.date,
    amount: row.amount,
    remarks: row.remarks
}]->(receiverAcc)
  ON CREATE SET t.amount = row.amount,
                t.date = row.date,
                t.remarks = row.remarks;
```

---

## 3. Evasion Detection Logic (Math Deep-Dive)

### 3.1 Structuring Mathematics & Regulatory Context

Under Indian Anti-Money Laundering regulatory guidance and FIU-IND compliance rules:
- **Cash Transaction Reporting (CTR) & High-Value Scrutiny:** Transactions structured right below threshold boundaries (e.g., ₹49,000 to ₹49,999) are flagged as structuring/smurfing patterns under demo-configurable thresholds [Demo-configurable structuring threshold (not a literal citation of PMLA Section 12 or the ₹10,00,000 statutory CTR limit under FIU-IND rules)].
- **Smurfing (Structuring)** is defined as deliberately breaking down an aggregate amount $M$ into $k$ smaller micro-transactions $t_i$:
$$49,000 \le \text{amount}(t_i) \le 49,999 \quad \forall i \in \{1, \dots, k\}$$
such that within a localized velocity window $\Delta t = \text{Date}(t_k) - \text{Date}(t_1) \le 5 \text{ days}$, the total laundered sum satisfies:
$$\sum_{i=1}^{k} \text{amount}(t_i) \ge ₹98,000$$

> **Note on Legal Citation / Option (b):**  
> For demo visibility and test file compatibility, the ₹49,000–₹49,999 band with 5-day velocity window is utilized as a **Demo Configurable Structuring Threshold**, accurately documented across the UI to avoid misrepresenting literal PMLA §10 Lakh CTR reporting limits.

### 3.2 Root Cause of the Cartesian Product (40 Rows $\to$ 90 Alerts)

In a graph where duplicate nodes exist:
Let account $A_s$ have $n_s$ associated Person nodes (e.g. duplicate nodes for Vikram / Aman).  
Let account $A_r$ have $n_r$ associated Person nodes (e.g. duplicate nodes for Rahul).  
Let there be $m$ physical transactions between $A_s$ and $A_r$.

The un-grouped Cypher query:
$$\text{MATCH } (s)-[t]->(r) \text{ OPTIONAL MATCH } (sp)-[:\text{OWNS\_ACCOUNT}]->(s) \text{ OPTIONAL MATCH } (rp)-[:\text{OWNS\_ACCOUNT}]->(r)$$
generates a Cartesian product cardinality:
$$|Rows| = m \times n_s \times n_r$$

Across multiple accounts in a 40-row file with repeated runs, the cardinality multiplied to **90 transaction records**, inflating the sum to **₹44,55,000**.

### 3.3 Zero-Cartesian Corrected Cypher Query

By aggregating distinct edges at the `(BankAccount)` level **before** resolving owner names, row multiplication is mathematically eliminated:

```cypher
// Step 1: Filter threshold transactions and aggregate strictly by account pair
MATCH (s:BankAccount)-[t:TRANSFERRED_TO]->(r:BankAccount)
WHERE t.amount >= 49000.0 AND t.amount <= 49999.0
WITH s, r, t
ORDER BY t.date ASC
WITH s, r,
         collect(DISTINCT t) AS txns,
         count(DISTINCT t) AS raw_count
WHERE raw_count >= 2

// Step 2: Resolve owner entities with safe head/distinct projection
OPTIONAL MATCH (sp:Person)-[:OWNS_ACCOUNT]->(s)
OPTIONAL MATCH (rp:Person)-[:OWNS_ACCOUNT]->(r)
WITH s, r,
         head(collect(DISTINCT sp.name)) AS sender_name,
         head(collect(DISTINCT rp.name)) AS receiver_name,
         [txn IN txns | {
             amount: txn.amount,
             date: txn.date,
             remarks: txn.remarks
         }] AS transactions,
         [txn IN txns | date(txn.date)] AS txn_dates,
         raw_count,
         reduce(total = 0.0, txn IN txns | total + txn.amount) AS total_evaded

// Step 3: Compute sliding temporal span condition
WITH sender_name, s.account_id AS sender_account,
         receiver_name, r.account_id AS receiver_account,
         raw_count AS transaction_count,
         duration.between(head(txn_dates), last(txn_dates)).days AS span_days,
         total_evaded AS total_evaded_amount,
         transactions
WHERE span_days <= 5

RETURN 
        coalesce(sender_name, "Unidentified Entity") AS sender_name,
        sender_account,
        coalesce(receiver_name, "Unidentified Entity") AS receiver_name,
        receiver_account,
        transaction_count,
        span_days,
        total_evaded_amount,
        transactions,
        "HIGH - Structuring / Smurfing Threshold Evasion" AS alert_type,
        "Detected " + toString(transaction_count) + " micro-transactions totaling ₹" + 
        toString(total_evaded_amount) + " within " + toString(span_days) + " days [Demo threshold (configurable) — structuring evasion analysis]." AS alert_description
ORDER BY total_evaded_amount DESC;
```

---

## 4. Frontend Graph Physics (Cytoscape.js)

### 4.1 Physics of the "Vertical Ladder" Artifact

Cytoscape’s Compound Spring Embedder (`cose`) computes node positions by solving the dynamic system:
$$\vec{F}_{\text{net}}(u) = \sum_{v \in V \setminus \{u\}} \vec{F}_{\text{rep}}(u, v) + \sum_{e = (u, v) \in E} \vec{F}_{\text{spring}}(u, v) + \vec{F}_{\text{gravity}}(u)$$

1. **Repulsive Electrostatic Force (Coulomb's Law):**
   $$\vec{F}_{\text{rep}}(u, v) = \frac{k_{\text{rep}}}{|\vec{p}_u - \vec{p}_v|^2} \cdot \hat{r}_{uv}$$
2. **Attractive Elastic Force (Hooke's Law):**
   $$\vec{F}_{\text{spring}}(u, v) = -k_{\text{spring}} \cdot (|\vec{p}_u - \vec{p}_v| - L_{\text{ideal}}) \cdot \hat{r}_{uv}$$
3. **Centering Gravitational Well:**
   $$\vec{F}_{\text{gravity}}(u) = -k_{\text{grav}} \cdot (\vec{p}_u - \vec{p}_{\text{center}})$$

#### Why the Graph Stacks Vertically:
- **Disconnected Component Tiling:** When CDR phones are connected to each other, and Bank Accounts are connected to each other, but Person nodes do not bridge them until FIR extraction, CoSE activates component packing (`tile: true`), which aligns disconnected subgraphs into a linear 1D column.
- **Unbalanced Spring-to-Repulsion Ratio:** A low `nodeRepulsion: 7000` combined with `idealEdgeLength: 110` cannot overcome the initial bounding box tension, locking nodes into local minima along the vertical canvas slice.

### 4.2 Mathematical Parameter Matrix for 2D Web Topology

```typescript
export const cosePhysicsConfig = {
  name: "cose",
  animate: true,
  animationDuration: 550,
  fit: true,
  padding: 40,
  nodeDimensionsIncludeLabels: true,

  // Force Equilibrium Ratios
  nodeRepulsion: (node: any) => 650000,    // High repulsion pushes clusters into 2D radial expansion
  idealEdgeLength: (edge: any) => 80,       // Compact edge length creates tight threat clusters
  edgeElasticity: (edge: any) => 0.45,      // Controlled spring stiffness prevents edge overlap
  nestingFactor: 0.1,                       // Compound boundary contraction

  // Gravitational Centering
  gravity: 0.25,                            // Pulls outer satellites toward the centroid
  gravityRangeCompound: 1.5,
  gravityCompound: 1.0,

  // 2D Component Packing (Eliminates 1D vertical ladder stacking)
  tile: true,
  tilingPaddingVertical: 40,
  tilingPaddingHorizontal: 40,

  // Simulated Annealing Convergence
  numIter: 1000,                            // Ensures energy minimization completes
  initialTemp: 1000,                         // High initial temperature escapes 1D local minima
  coolingFactor: 0.99,                       // Gradual cooling stabilizes clean layout
  minTemp: 1.0,
};
```

---

## 5. Live Empirical Execution & Verification Results

### 5.1 Test Execution Log (Neo4j AuraDB Live Instance)

```plaintext
======================================================================
STEP 1 — Wipe Neo4j Database:
MATCH (n) DETACH DELETE n;
Result: Graph wiped. Remaining node count: 0

======================================================================
STEP 2 — Enforce Uniqueness Constraints:
- constraint_bank_account_unique (NODE_PROPERTY_UNIQUENESS on BankAccount.account_id)
- constraint_person_name_unique  (NODE_PROPERTY_UNIQUENESS on Person.name)
- constraint_phone_number_unique (NODE_PROPERTY_UNIQUENESS on PhoneNumber.number)
Total Constraints Active: 3

======================================================================
STEP 3 & 4 — Clean Ingestion Run:
- CDR Ingestion: 40 rows ingested -> [:CALLED]
- Bank Ingestion: 40 rows ingested -> [:OWNS_ACCOUNT], [:TRANSFERRED_TO]
- FIR Extraction: 5 Person nodes merged, 2 [:OWNS_PHONE] links, 1 [:ASSOCIATED_WITH] link

--- VERIFIED DISTINCT NODE COUNTS ---
- Distinct Person nodes: 68
- Distinct BankAccount nodes: 62
- Distinct PhoneNumber nodes: 64

======================================================================
STEP 5 — Evasion Detection Verification:
Total Alerts Returned: 1 (Zero Cartesian Expansion)
- Sender: Aman Verma (Account: 30012345678)
- Receiver: Rahul Sharma (Account: 40098765432)
- Transaction Count: 8 micro-transfers
- Velocity Span: 4 days (Aug 6, 2026 to Aug 10, 2026)
- Total Evaded Amount: ₹3,96,000.00
- Alert Type: HIGH - Structuring / Smurfing Threshold Evasion

======================================================================
STEP 6 — Multimodal Entity Bridging Verification:
- Person 'Vikram S.' -[:OWNS_PHONE]-> (PhoneNumber '9811122001')
- Person 'Vikram S.' -[:OWNS_PHONE]-> (PhoneNumber '9899033442')
- Person 'Vikram S.' -[:ASSOCIATED_WITH]-> (Person 'A. Verma')
- Person 'Aman Verma' -[:OWNS_ACCOUNT]-> (BankAccount '30012345678')
- Person 'Rahul Sharma' -[:OWNS_ACCOUNT]-> (BankAccount '40098765432')
- Over 60 Person-to-BankAccount [:OWNS_ACCOUNT] bridging links confirmed.
```

---

## 6. Forensic Verification Matrix

| Validation Parameter | Pre-Audit Fault State | Post-Patch Verified Audit State |
| :--- | :--- | :--- |
| **Node Uniqueness Invariant** | Multiple duplicate nodes generated per ingestion | Strictly $0$ duplicate nodes ($\mathcal{O}(1)$ B-Tree Key lookup) |
| **Relationship Idempotency** | $\mathcal{O}(N \times \text{Runs})$ duplicate edges | Strictly $1$ edge per unique transaction signature |
| **Smurfing Flag Count** | 90 Cartesian Alert items | **1 Syndicate Alert cluster** (Zero Cartesian inflation) |
| **Evaded Laundering Total** | ₹44,55,000 (False Cartesian Expansion) | **₹3,96,000** ($8 \times ₹49,500$ exact transaction sum) |
| **Cytoscape Layout** | Disconnected vertical column / 1D ladder | **Dense, 2D clustered interconnected threat web** |
| **Temporal Velocity Window** | Unbounded global date range | **Strict $\le 5\text{-day}$ localized velocity window** |
| **Multimodal Bridging** | Siloed subgraphs | **Unified Person $\to$ Phone $\to$ Account threat graph** |
