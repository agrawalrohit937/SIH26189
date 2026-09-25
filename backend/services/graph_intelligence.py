import logging
from typing import Dict, Any, List
from database import db

# ==============================================================================
# POLICY CONVENTION:
# Do not add specific legal citations (rule numbers, section numbers, thresholds
# attributed to a named law) to any generated text unless that exact citation
# has been manually verified by a human and hardcoded as a reviewed constant.
# Never let the LLM or any generation logic invent one.
# ==============================================================================

logger = logging.getLogger(__name__)


def detect_smurfing_patterns() -> List[Dict[str, Any]]:
    """
    Detects 'Smurfing' / Structuring evasion patterns where BankAccount transfers
    are kept in the range (₹49,000 <= amount <= ₹49,999) occurring multiple times within a 5-day window.
    Demo-configurable structuring threshold (not a literal citation of statutory CTR limits under FIU-IND rules).
    """

    cypher_query = """
    MATCH (s:BankAccount)-[t:TRANSFERRED_TO]->(r:BankAccount)
    WHERE t.amount >= 49000.0 AND t.amount <= 49999.0
    WITH s, r, t
    ORDER BY t.date ASC
    WITH s, r,
         collect(DISTINCT t) AS txns,
         count(DISTINCT t) AS raw_count
    WHERE raw_count >= 2

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
        "Detected " + toString(transaction_count) + " repeated micro-transfers totaling ₹" + 
        toString(total_evaded_amount) + " within " + toString(span_days) + " days, matching a known structured financial evasion pattern." AS alert_description
    ORDER BY total_evaded_amount DESC
    """

    logger.info("Executing Cypher Smurfing / Structuring evasion detection query...")
    results = db.execute_query(cypher_query)
    logger.info(f"Smurfing detection returned {len(results)} alert patterns.")
    return results
