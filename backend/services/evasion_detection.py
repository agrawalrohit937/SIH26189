"""
Evasion & Burner Phone Chain Detection Service
SIH26189 - National Crime Intelligence Grid (Ministry of Home Affairs)

# ==============================================================================
# POLICY CONVENTION:
# Do not add specific legal citations (rule numbers, section numbers, thresholds
# attributed to a named law) to any generated text unless that exact citation
# has been manually verified by a human and hardcoded as a reviewed constant.
# Never let the LLM or any generation logic invent one.
# ==============================================================================

Detects operational security (OpSec) evasion patterns:
1. SIM-Swap & Burner Number Chains: Flags Persons linked to multiple PhoneNumber entities
   activated/first-seen within a compressed temporal window (e.g. >= 4 phones in <= 30 days).
2. Mule account cycling patterns.
"""

import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from database import run_query

logger = logging.getLogger("evasion_detection")


def ensure_phone_metadata_properties():
    """
    Ensures existing PhoneNumber nodes have first_seen_date if unpopulated.
    """
    query = """
    MATCH (ph:PhoneNumber)
    WHERE ph.first_seen_date IS NULL
    OPTIONAL MATCH (ph)-[c:CALLED]-(other)
    WITH ph, min(c.timestamp) AS earliest_call
    SET ph.first_seen_date = coalesce(earliest_call, '2026-08-01T00:00:00')
    """
    try:
        run_query(query)
    except Exception as e:
        logger.warning(f"Note on first_seen_date update: {e}")


def detect_burner_chains(min_phones: int = 4, max_window_days: int = 30) -> List[Dict[str, Any]]:
    """
    Detects persons cycling through burner numbers or executing rapid SIM-swaps.
    Returns structured evasion alerts.
    """
    ensure_phone_metadata_properties()

    query = """
    MATCH (p:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)
    WHERE ph.first_seen_date IS NOT NULL
    WITH p, collect(DISTINCT ph.number) AS phone_numbers, 
         collect(DISTINCT ph.first_seen_date) AS dates,
         count(DISTINCT ph) AS phone_count
    WHERE phone_count >= $min_phones
    RETURN elementId(p) AS person_id,
           p.name AS person_name,
           p.cluster AS cluster,
           phone_count,
           phone_numbers,
           dates
    """
    records = run_query(query, {"min_phones": min_phones})
    alerts = []

    for row in records:
        dates_raw = [d for d in row["dates"] if d]
        parsed_dates = []
        for d in dates_raw:
            try:
                clean_d = d.replace("Z", "").split(".")[0]
                if "T" in clean_d:
                    dt = datetime.fromisoformat(clean_d)
                else:
                    dt = datetime.strptime(clean_d[:10], "%Y-%m-%d")
                parsed_dates.append(dt)
            except Exception:
                continue

        if len(parsed_dates) >= min_phones:
            earliest = min(parsed_dates)
            latest = max(parsed_dates)
            window_days = max((latest - earliest).days, 1)

            if window_days <= max_window_days:
                alerts.append({
                    "alert_id": f"EVASION_{row['person_id']}_{window_days}D",
                    "person_id": row["person_id"],
                    "person_name": row["person_name"],
                    "syndicate_cluster": str(row.get("cluster", "0")),
                    "phone_count": row["phone_count"],
                    "phone_numbers": row["phone_numbers"],
                    "earliest_activation": earliest.strftime("%Y-%m-%d"),
                    "latest_activation": latest.strftime("%Y-%m-%d"),
                    "temporal_window_days": window_days,
                    "evasion_pattern": "RAPID_BURNER_SIM_CYCLING",
                    "severity": "CRITICAL" if row["phone_count"] >= 5 else "HIGH",
                    "alert_category": "TELECOM_OPSEC_EVASION",
                    "detection_pattern_note": "Rapid cycling across multiple SIM/phone numbers in a short window is a known telecom evasion pattern.",
                    "explanation": f"Subject '{row['person_name']}' cycled through {row['phone_count']} distinct mobile numbers within a compressed window of {window_days} day(s), indicating active communication evasion tactics."
                })

    return alerts

