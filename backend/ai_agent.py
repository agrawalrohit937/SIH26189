"""
Law Enforcement AI Intelligence Copilot (SIH26189)
Ministry of Home Affairs - National Crime Intelligence Grid

# ==============================================================================
# POLICY CONVENTION:
# Do not add specific legal citations (rule numbers, section numbers, thresholds
# attributed to a named law) to any generated text unless that exact citation
# has been manually verified by a human and hardcoded as a reviewed constant.
# Never let the LLM or any generation logic invent one.
# ==============================================================================

Multi-Tool AI Agent Architecture:
- Pre-Execution Security Guardrails (Injection refusal & destructive command blocking)
- Tool 1: Graph-RAG Query Tool (Structured parameterized Cypher context over nodes & edges)
- Tool 2: Document RAG Search Tool (Vector cosine-similarity retrieval over FIR narratives with traceable paragraph citations)
- Tool 3: Timeline Reconstruction Tool (Chronological call & transaction sequence analysis)
"""


import logging
from typing import Optional, Dict, Any, List
from groq import Groq
from config import get_settings
from database import db
from services.graph_intelligence import detect_smurfing_patterns
from services.document_rag import document_search_tool, graph_query_tool, timeline_tool

logger = logging.getLogger(__name__)

# Guardrails against prompt injection and destructive queries
MALICIOUS_CYPHER_PATTERNS = [
    "detach delete",
    "delete",
    "drop index",
    "drop constraint",
    "remove",
    "set ",
    "create ",
    "merge "
]


def validate_user_query_safety(user_message: str) -> Optional[str]:
    """
    Guardrail: Inspects user input for attempted prompt-injection or destructive Cypher.
    Returns refusal message if malicious intent detected.
    """
    lower = user_message.lower()
    for pattern in MALICIOUS_CYPHER_PATTERNS:
        if pattern in lower and ("match" in lower or "ignore" in lower or "database" in lower or "drop" in lower):
            logger.warning(f"Guardrail tripped: User attempted potential destructive command: {user_message}")
            return (
                "🛡️ [SECURITY GUARDRAIL TRIGGERED]\n\n"
                "Destructive operations and arbitrary Cypher execution are strictly forbidden. "
                "The AI Investigator Copilot operates strictly in read-only analytical mode over verified case evidence."
            )
    return None


def get_live_investigative_context(user_query: str) -> str:
    """
    Multi-Tool Context Builder:
    1. Runs Document RAG over FIR texts to retrieve relevant paragraphs with citations.
    2. Runs Graph Tool for structured suspect profiles & structuring alerts.
    """
    context_sections = []

    # 1. Document Search Tool (Vector RAG)
    doc_results = document_search_tool(user_query)
    if doc_results.get("found") and doc_results.get("results"):
        doc_lines = ["--- RELEVANT FIR NARRATIVE EXCERPTS (WITH CITATIONS) ---"]
        for d in doc_results["results"]:
            doc_lines.append(f"[{d['citation']} | Relevance: {d['score']}]:\n\"{d['content']}\"")
        doc_lines.append("---------------------------------------------------------")
        context_sections.append("\n".join(doc_lines))

    # 2. Graph Query & Telemetry Context
    try:
        person_res = db.execute_query("""
            MATCH (p:Person)
            OPTIONAL MATCH (p)-[:OWNS_PHONE]->(ph:PhoneNumber)
            OPTIONAL MATCH (p)-[:OWNS_ACCOUNT]->(acc:BankAccount)
            RETURN p.name AS name, p.role AS role, p.aliases AS aliases, p.cluster AS cluster,
                   collect(DISTINCT ph.number) AS phones,
                   collect(DISTINCT acc.account_id) AS accounts
            LIMIT 12
        """)

        alerts = detect_smurfing_patterns()

        stats = db.execute_query("""
            MATCH (n)
            OPTIONAL MATCH ()-[r]->()
            RETURN count(DISTINCT n) AS total_nodes, count(DISTINCT r) AS total_edges
        """)
        total_nodes = stats[0]["total_nodes"] if stats else 0
        total_edges = stats[0]["total_edges"] if stats else 0

        graph_lines = [
            f"Active Database State: {total_nodes} nodes, {total_edges} relationships.",
            "\nIdentified Suspect Entities (Neo4j Graph Store):"
        ]
        for p in person_res:
            p_name = p.get("name")
            p_role = p.get("role") or "Suspect"
            p_cluster = p.get("cluster") or "0"
            p_aliases = p.get("aliases") or []
            p_phones = p.get("phones") or []
            p_accounts = p.get("accounts") or []
            alias_str = f" (Aliases: {', '.join(p_aliases)})" if p_aliases else ""
            phone_str = f" | Phones: {', '.join(p_phones)}" if p_phones else ""
            acc_str = f" | Accounts: {', '.join(p_accounts)}" if p_accounts else ""
            graph_lines.append(f"- {p_name} [{p_role} | Syndicate Cell #{p_cluster}]{alias_str}{phone_str}{acc_str}")

        if alerts:
            graph_lines.append(f"\nActive Structuring / Smurfing Alerts ({len(alerts)} detected):")
            for a in alerts[:4]:
                graph_lines.append(
                    f"- Sender: {a.get('sender_name')} ({a.get('sender_account')}) -> "
                    f"Receiver: {a.get('receiver_name')} ({a.get('receiver_account')}) | "
                    f"Count: {a.get('transaction_count')} transfers | "
                    f"Total: ₹{a.get('total_evaded_amount'):,.2f}"
                )

        context_sections.append("\n".join(graph_lines))
    except Exception as e:
        logger.warning(f"Could not fetch graph context: {e}")
        context_sections.append("Graph structure context currently updating.")

    return "\n\n".join(context_sections)


def chat_with_copilot(user_message: str) -> str:
    """
    Sends the user query along with multi-tool RAG and structured graph context to Groq
    (openai/gpt-oss-20b) and returns an actionable, cited intelligence brief.
    """
    # 1. Guardrail Check
    safety_refusal = validate_user_query_safety(user_message)
    if safety_refusal:
        return safety_refusal

    # 2. Multi-Tool RAG Context Retrieval
    live_context = get_live_investigative_context(user_message)

    system_prompt = f"""You are the Lead Cyber-Intelligence AI Copilot for the National Crime Intelligence Grid (SIH26189 - Ministry of Home Affairs).
You assist intelligence officers, financial fraud investigators, and law enforcement analysts in dissecting criminal networks, Hawala smurfing syndicates, and telecom burner chains.

Investigative Standards:
1. Structure answers cleanly with tactical bullet points, bold key entities, and clear headers.
2. CITATION MANDATE: When referencing facts, meetings, modus operandi, or events described in narrative FIR incident reports, you MUST explicitly include inline citations in the exact format: (per FIR#<number>, para <p_idx>).
3. Do NOT fabricate citations or facts. Ground all statements strictly in the verified multi-tool context provided below.
4. Reference tactical actions: CDR cell tower triangulation, freezing beneficiary mule accounts, and tracing cross-cluster coordinators.
5. LEGAL CITATION POLICY: NEVER invent, fabricate, or guess legal rule numbers, section numbers, or act citations. If discussing evasion or money laundering, describe the operational pattern without fabricating unverified law sections.


=== MULTI-TOOL EVIDENCE CONTEXT (GRAPH + VECTOR DOCUMENT RAG) ===
{live_context}
==================================================================

Provide a professional, tactical investigative analysis:"""

    settings = get_settings()
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured.")
        return (
            "[SYSTEM NOTICE: Groq API Key required for real-time generative reasoning]\n\n"
            f"Verified Evidence Summary:\n{live_context}"
        )

    try:
        client = Groq(api_key=settings.GROQ_API_KEY, timeout=8.0)
        logger.info(f"Dispatching query to Groq LLM: {user_message[:60]}...")
        model_name = getattr(settings, "GROQ_MODEL", "llama-3.1-8b-instant") or "llama-3.1-8b-instant"

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.15,
            max_tokens=600,
        )

        reply = response.choices[0].message.content
        return reply.strip()
    except Exception as e:
        logger.error(f"Error in Groq chat completion: {e}", exc_info=True)
        return (
            f"Intelligence Analysis Fallback (LLM Exception: {str(e)}).\n\n"
            f"Evidence Context:\n{live_context}"
        )
