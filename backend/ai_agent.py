import logging
from typing import Optional, Dict, Any, List
from groq import Groq
from config import get_settings
from database import db
from services.graph_intelligence import detect_smurfing_patterns

logger = logging.getLogger(__name__)


def get_live_investigative_context() -> str:
    """
    Fetches real-time intelligence from the active Neo4j graph database to provide
    context-aware facts to the AI Investigator Copilot.
    """
    try:
        # Get suspect persons and roles
        person_res = db.execute_query("""
            MATCH (p:Person)
            OPTIONAL MATCH (p)-[:OWNS_PHONE]->(ph:PhoneNumber)
            OPTIONAL MATCH (p)-[:OWNS_ACCOUNT]->(acc:BankAccount)
            RETURN p.name AS name, p.role AS role, p.aliases AS aliases,
                   collect(DISTINCT ph.number) AS phones,
                   collect(DISTINCT acc.account_id) AS accounts
            LIMIT 10
        """)

        # Get detected smurfing alerts
        alerts = detect_smurfing_patterns()

        # Get total graph statistics
        stats = db.execute_query("""
            MATCH (n)
            OPTIONAL MATCH ()-[r]->()
            RETURN count(DISTINCT n) AS total_nodes, count(DISTINCT r) AS total_edges
        """)
        total_nodes = stats[0]["total_nodes"] if stats else 0
        total_edges = stats[0]["total_edges"] if stats else 0

        context_lines = [
            f"Active Database State: {total_nodes} nodes, {total_edges} relationships.",
            "\nIdentified Suspect Entities:"
        ]
        for p in person_res:
            p_name = p.get("name")
            p_role = p.get("role") or "Suspect"
            p_aliases = p.get("aliases") or []
            p_phones = p.get("phones") or []
            p_accounts = p.get("accounts") or []
            alias_str = f" (Aliases: {', '.join(p_aliases)})" if p_aliases else ""
            phone_str = f" | Phones: {', '.join(p_phones)}" if p_phones else ""
            acc_str = f" | Accounts: {', '.join(p_accounts)}" if p_accounts else ""
            context_lines.append(f"- {p_name} [{p_role}]{alias_str}{phone_str}{acc_str}")

        if alerts:
            context_lines.append(f"\nActive Structuring / Smurfing Alerts ({len(alerts)} detected):")
            for a in alerts[:5]:
                context_lines.append(
                    f"- Sender: {a.get('sender_name')} ({a.get('sender_account')}) -> "
                    f"Receiver: {a.get('receiver_name')} ({a.get('receiver_account')}) | "
                    f"Count: {a.get('transaction_count')} transfers | "
                    f"Total: ₹{a.get('total_evaded_amount'):,.2f} over {a.get('span_days')} days"
                )
        else:
            context_lines.append("\nNo smurfing/structuring patterns currently flagged above threshold.")

        return "\n".join(context_lines)
    except Exception as e:
        logger.warning(f"Could not build live investigative context from Neo4j: {e}")
        return "Live graph context temporarily unavailable from database."


def chat_with_copilot(user_message: str) -> str:
    """
    Sends the user's investigative query along with live Neo4j graph context to Groq
    (openai/gpt-oss-20b) and returns an actionable, tactical intelligence copilot response.
    """
    live_context = get_live_investigative_context()

    system_prompt = f"""You are an elite cyber-intelligence law enforcement AI Copilot (SIH26189).
You assist intelligence officers, financial fraud investigators, and police analysts in investigating criminal syndicates, Hawala networks, money laundering, and CDR telecom patterns.

Investigative Guidelines:
1. Keep answers concise, highly tactical, structured, and professional.
2. Ground all answers strictly in the active case evidence provided below.
3. Reference standard investigative procedures: check CDR logs & cell tower triangulation, trace bank transaction structuring/smurfing, identify money mules and account handlers, map entity ownerships, and cite AML/PMLA financial evasion provisions.

--- CURRENT LIVE EVIDENCE IN DATABASE ---
{live_context}
-----------------------------------------

Provide direct, actionable intelligence briefs with tactical bullet points where appropriate."""

    settings = get_settings()
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set. Returning dynamic contextual advisory.")
        return (
            f"[SYSTEM NOTICE: Groq API Key not configured in backend .env]\n\n"
            f"Active Evidence Summary:\n{live_context}\n\n"
            "Investigative Advisory: Cross-reference high-frequency telecom nodes with bank accounts showing "
            "sub-₹50,000 structuring transfers. Freeze beneficiary accounts under applicable financial fraud provisions."
        )

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        logger.info(f"Dispatching query to Groq LLM: {user_message[:60]}...")

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.2,
            max_tokens=600,
        )

        reply = response.choices[0].message.content
        return reply.strip()
    except Exception as e:
        logger.error(f"Error in Groq chat completion: {e}", exc_info=True)
        return (
            f"Intelligence Analysis Notice (LLM Error: {str(e)}).\n\n"
            f"Active Evidence Summary:\n{live_context}"
        )
