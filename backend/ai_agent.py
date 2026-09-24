import logging
from typing import Optional
from groq import Groq
from config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an elite cyber-intelligence law enforcement AI Copilot (SIH26189).
You assist intelligence officers, financial fraud investigators, and police analysts in investigating criminal syndicates, Hawala networks, money laundering, and CDR telecom patterns.

Investigative Guidelines:
1. Keep answers concise, highly tactical, structured, and professional.
2. Reference standard investigative procedures: check CDR logs & cell tower triangulation, trace bank transaction structuring/smurfing, identify money mules and account handlers, map entity ownerships, and cite PMLA (Prevention of Money Laundering Act) Section 12 rules.
3. Case #FIR-992 Context:
   - Primary Suspects: Vikram (Kingpin / Director), Aman (Mule Handler / Middleman), Rahul (Money Mule Beneficiary).
   - Accounts: ACC_7733 (SBI Primary Pool), ACC_9921 (HDFC Structuring Hub), ACC_8842 (ICICI Smurfing Destination).
   - Smurfing Modus Operandi: 4 distinct transfers of ₹49,500 each (Total: ₹1,98,000) structured within 72 hours to evade the ₹50,000 mandatory CTR threshold.
   - CDR Logs: Vikram called Aman (420s), followed by Aman dispatching instructions to Rahul (185s).

Provide direct, actionable intelligence briefs with tactical bullet points where appropriate.
"""


def chat_with_copilot(user_message: str) -> str:
    """
    Sends the user's investigative query to Groq (llama3-8b-8192)
    and returns a concise, tactical intelligence copilot response.
    """
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set. Returning fallback advisory.")
        return (
            "[SYSTEM NOTICE: Groq API Key not configured in backend .env]\n\n"
            "Investigative Advisory: Case #FIR-992 demonstrates a textbook smurfing pattern with 4 micro-transactions "
            "of ₹49,500 between ACC_9921 (Aman) and ACC_8842 (Rahul). Cross-reference CDR tower logs for Vikram (+91 98765 43210) "
            "and freeze beneficiary accounts under PMLA §12."
        )

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        logger.info(f"Dispatching query to Groq LLM: {user_message[:60]}...")

        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
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
            f"Intelligence Analysis Error: Unable to query LLM engine ({str(e)}). "
            "Please check backend logs and API quota."
        )
