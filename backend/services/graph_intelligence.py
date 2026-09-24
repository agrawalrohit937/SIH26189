import logging
from typing import Dict, Any, List
from database import db

logger = logging.getLogger(__name__)


def detect_smurfing_patterns() -> List[Dict[str, Any]]:
    """
    Detects 'Smurfing' / Structuring evasion patterns where BankAccount transfers
    are deliberately kept just below reporting thresholds (₹49,000 <= amount <= ₹49,999)
    and occur multiple times within a 5-day window between related or designated accounts.
    """
    cypher_query = """
    MATCH (senderAcc:BankAccount)-[t:TRANSFERRED_TO]->(receiverAcc:BankAccount)
    WHERE t.amount >= 49000 AND t.amount <= 49999
    OPTIONAL MATCH (senderPerson:Person)-[:OWNS_ACCOUNT]->(senderAcc)
    OPTIONAL MATCH (receiverPerson:Person)-[:OWNS_ACCOUNT]->(receiverAcc)
    WITH senderPerson, senderAcc, receiverPerson, receiverAcc, t
    ORDER BY t.date ASC
    WITH senderPerson, senderAcc, receiverPerson, receiverAcc,
         collect({
             amount: t.amount,
             date: t.date,
             remarks: t.remarks
         }) AS transactions,
         collect(date(t.date)) AS txn_dates,
         count(t) AS transaction_count,
         sum(t.amount) AS total_evaded_amount
    WHERE transaction_count >= 2
    WITH senderPerson, senderAcc, receiverPerson, receiverAcc,
         transactions, txn_dates, transaction_count, total_evaded_amount,
         duration.between(head(txn_dates), last(txn_dates)).days AS span_days
    WHERE span_days <= 5
    RETURN 
        coalesce(senderPerson.name, "Unknown") AS sender_name,
        senderAcc.account_id AS sender_account,
        coalesce(receiverPerson.name, "Unknown") AS receiver_name,
        receiverAcc.account_id AS receiver_account,
        transaction_count,
        span_days,
        total_evaded_amount,
        transactions,
        "HIGH - Structuring / Smurfing Threshold Evasion" AS alert_type,
        "Multiple transactions between ₹49,000 and ₹49,999 detected within " + toString(span_days) + " days to evade PAN/AML reporting." AS alert_description
    ORDER BY total_evaded_amount DESC
    """

    logger.info("Executing Cypher Smurfing / Structuring evasion detection query...")
    results = db.execute_query(cypher_query)
    logger.info(f"Smurfing detection returned {len(results)} alert patterns.")
    return results
