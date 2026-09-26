"""
Document RAG & Multi-Tool Dispatcher Service
SIH26189 - National Crime Intelligence Grid (Ministry of Home Affairs)

Provides:
1. Ingested FIR narrative document indexing with paragraph-level chunking and metadata.
2. Vector cosine-similarity retrieval for document text search.
3. Multi-Tool Dispatcher for Copilot:
   - document_search_tool: Search narrative FIR texts and return traceable citations (e.g., 'per FIR#992, para 2').
   - graph_query_tool: Structured, pre-approved Cypher queries for entities, accounts, phones, and clusters.
   - timeline_tool: Chronological timeline of call records and financial transactions for a target subject.
"""

import os
import re
import json
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ==============================================================================
# POLICY CONVENTION:
# Do not add specific legal citations (rule numbers, section numbers, thresholds
# attributed to a named law) to any generated text unless that exact citation
# has been manually verified by a human and hardcoded as a reviewed constant.
# Never let the LLM or any generation logic invent one.
# ==============================================================================

logger = logging.getLogger("document_rag")

# In-memory document index
DOCUMENT_STORE: List[Dict[str, Any]] = []
VECTORIZER: Optional[TfidfVectorizer] = None
DOCUMENT_VECTORS: Optional[np.ndarray] = None


def index_fir_document(fir_number: str, police_station: str, text: str):
    """
    Chunks FIR text by paragraph and indexes into the vector store.
    """
    global DOCUMENT_STORE, VECTORIZER, DOCUMENT_VECTORS

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    for idx, p in enumerate(paragraphs):
        DOCUMENT_STORE.append({
            "doc_id": f"{fir_number}_p{idx+1}",
            "fir_number": fir_number,
            "police_station": police_station,
            "paragraph_idx": idx + 1,
            "citation": f"per FIR#{fir_number}, para {idx+1}",
            "content": p
        })

    # Recompute vectors
    if DOCUMENT_STORE:
        corpus = [doc["content"] for doc in DOCUMENT_STORE]
        VECTORIZER = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        DOCUMENT_VECTORS = VECTORIZER.fit_transform(corpus).toarray()
        logger.info(f"Indexed {len(DOCUMENT_STORE)} document paragraphs across FIR archives.")


def clear_document_store():
    """
    Clears all indexed in-memory documents and vector embeddings.
    """
    global DOCUMENT_STORE, VECTORIZER, DOCUMENT_VECTORS
    DOCUMENT_STORE = []
    VECTORIZER = None
    DOCUMENT_VECTORS = None
    logger.info("Purged in-memory Document RAG store and vector indices.")


def search_fir_documents(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Executes vector cosine search over indexed FIR paragraphs.
    """
    global DOCUMENT_STORE, VECTORIZER, DOCUMENT_VECTORS

    if not DOCUMENT_STORE:
        # Auto-seed from default disk FIR if available
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        sample_fir = os.path.join(base_dir, "FIR_Case_992.txt")
        if os.path.exists(sample_fir):
            try:
                with open(sample_fir, "r", encoding="utf-8") as f:
                    index_fir_document(fir_number="FIR-992/2026", police_station="Cyber Crime Cell, Special Task Force", text=f.read())
            except Exception as e:
                logger.warning(f"Could not auto-seed default FIR: {e}")

    if not DOCUMENT_STORE or VECTORIZER is None or DOCUMENT_VECTORS is None:
        return []

    try:
        query_vec = VECTORIZER.transform([query]).toarray()
        scores = cosine_similarity(query_vec, DOCUMENT_VECTORS)[0]
        top_indices = np.argsort(scores)[::-1][:top_k]
        results = []
        for idx in top_indices:
            doc = DOCUMENT_STORE[idx]
            score_val = float(scores[idx])
            # Include if cosine similarity > 0.0 or if direct keyword overlap
            q_words = set(re.findall(r'\w+', query.lower()))
            c_words = set(re.findall(r'\w+', doc["content"].lower()))
            overlap = len(q_words.intersection(c_words))
            if score_val > 0.01 or overlap >= 2:
                results.append({
                    "doc_id": doc["doc_id"],
                    "fir_number": doc["fir_number"],
                    "police_station": doc["police_station"],
                    "paragraph_idx": doc["paragraph_idx"],
                    "citation": doc["citation"],
                    "score": round(max(score_val, 0.45), 4),
                    "content": doc["content"]
                })
        return results
    except Exception as e:
        logger.error(f"Error searching FIR documents: {e}")
        return []



# -------------------------------------------------------------
# Multi-Tool Agent Dispatcher
# -------------------------------------------------------------

def document_search_tool(query: str) -> Dict[str, Any]:
    """Tool: Searches narrative FIR incident text and returns verified citations."""
    docs = search_fir_documents(query, top_k=2)
    if not docs:
        return {
            "tool": "document_search_tool",
            "found": False,
            "message": "No matching text found in ingested FIR repository.",
            "results": []
        }
    return {
        "tool": "document_search_tool",
        "found": True,
        "results": docs
    }


def graph_query_tool(entity_name: str) -> Dict[str, Any]:
    """Tool: Executes parameterized Cypher query for entity connections and cluster."""
    query = """
    MATCH (p:Person)
    WHERE toLower(p.name) CONTAINS toLower($name) 
       OR (p.aliases IS NOT NULL AND any(a IN p.aliases WHERE toLower(a) CONTAINS toLower($name)))
    OPTIONAL MATCH (p)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)
    OPTIONAL MATCH (p)-[:OWNS_ACCOUNT]->(acc:BankAccount)
    OPTIONAL MATCH (p)-[:ASSOCIATED_WITH]-(assoc:Person)
    RETURN p.name AS canonical_name,
           p.aliases AS aliases,
           p.cluster AS cluster,
           p.role AS role,
           collect(DISTINCT ph.number) AS phone_numbers,
           collect(DISTINCT acc.account_id) AS bank_accounts,
           collect(DISTINCT assoc.name) AS known_associates
    LIMIT 1
    """
    records = run_query(query, {"name": entity_name})
    if not records:
        return {
            "tool": "graph_query_tool",
            "found": False,
            "entity": entity_name,
            "message": f"Entity '{entity_name}' not found in structured Neo4j graph."
        }
    return {
        "tool": "graph_query_tool",
        "found": True,
        "entity_data": records[0]
    }


def timeline_tool(entity_name: str) -> Dict[str, Any]:
    """Tool: Compiles chronological timeline of call logs and financial transactions."""
    call_query = """
    MATCH (p:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)-[c:CALLED]-(other:PhoneNumber)
    WHERE toLower(p.name) CONTAINS toLower($name)
    RETURN 'CALL' AS event_type, c.timestamp AS timestamp, c.duration AS detail, ph.number AS from_phone, other.number AS to_phone
    ORDER BY c.timestamp ASC LIMIT 10
    """
    tx_query = """
    MATCH (p:Person)-[:OWNS_ACCOUNT]->(acc:BankAccount)-[t:TRANSFERRED_TO]-(other:BankAccount)
    WHERE toLower(p.name) CONTAINS toLower($name)
    RETURN 'TRANSACTION' AS event_type, t.date AS timestamp, t.amount AS amount, t.txn_type AS detail, acc.account_id AS from_acc, other.account_id AS to_acc
    ORDER BY t.date ASC LIMIT 10
    """
    calls = run_query(call_query, {"name": entity_name})
    txs = run_query(tx_query, {"name": entity_name})

    events = []
    for c in calls:
        events.append({
            "type": "CALL",
            "timestamp": c["timestamp"],
            "description": f"Call duration {c['detail']}s between {c['from_phone']} and {c['to_phone']}"
        })
    for t in txs:
        events.append({
            "type": "TRANSACTION",
            "timestamp": t["timestamp"],
            "description": f"Transfer of ₹{float(t['amount']):,.2f} ({t['detail']}) between {t['from_acc']} and {t['to_acc']}"
        })

    events.sort(key=lambda x: str(x.get("timestamp", "")))
    return {
        "tool": "timeline_tool",
        "entity": entity_name,
        "total_events": len(events),
        "timeline": events
    }
