import os
import sqlite3
import hashlib
import datetime
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audit_log.db")
GENESIS_PREV_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_audit_db() -> None:
    """Initializes the tamper-evident hash-chained audit log SQLite database."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            actor TEXT NOT NULL,
            action_type TEXT NOT NULL,
            action_detail TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            this_hash TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_log(action_type);")
        conn.commit()
    logger.info(f"Audit Log database initialized at: {DB_PATH}")


def calculate_entry_hash(prev_hash: str, timestamp: str, actor: str, action_type: str, action_detail: str) -> str:
    """Computes SHA-256 hash over the entry fields chained with prev_hash."""
    payload = f"{prev_hash}|{timestamp}|{actor}|{action_type}|{action_detail}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def log_action(actor: str, action_type: str, action_detail: str) -> Dict[str, Any]:
    """
    Appends an immutable, hash-chained entry to the audit log table.
    Any tampering with prior rows breaks the SHA-256 chain verification.
    """
    init_audit_db()
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Retrieve the latest entry to link prev_hash
        cursor.execute("SELECT id, this_hash FROM audit_log ORDER BY id DESC LIMIT 1;")
        last_row = cursor.fetchone()

        prev_hash = last_row["this_hash"] if last_row else GENESIS_PREV_HASH
        this_hash = calculate_entry_hash(prev_hash, timestamp, actor, action_type, action_detail)

        cursor.execute("""
            INSERT INTO audit_log (timestamp, actor, action_type, action_detail, prev_hash, this_hash)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (timestamp, actor, action_type, action_detail, prev_hash, this_hash))
        conn.commit()

        entry_id = cursor.lastrowid

    logger.info(f"[AUDIT BLOCK #{entry_id}] {action_type} by '{actor}' | Hash: {this_hash[:12]}...")
    return {
        "id": entry_id,
        "timestamp": timestamp,
        "actor": actor,
        "action_type": action_type,
        "action_detail": action_detail,
        "prev_hash": prev_hash,
        "this_hash": this_hash
    }


def verify_audit_chain() -> Dict[str, Any]:
    """
    Recomputes SHA-256 hash chain sequentially from block 1 to N.
    Returns whether the ledger is cryptographically intact or tampered.
    """
    init_audit_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, timestamp, actor, action_type, action_detail, prev_hash, this_hash FROM audit_log ORDER BY id ASC;")
        rows = cursor.fetchall()

    if not rows:
        return {
            "status": "success",
            "chain_intact": True,
            "total_entries": 0,
            "genesis_prev_hash": GENESIS_PREV_HASH,
            "latest_hash": None,
            "tamper_detected": False,
            "tamper_index": None,
            "message": "Audit chain is empty. Ready for initial block recording."
        }

    expected_prev = GENESIS_PREV_HASH
    for idx, row in enumerate(rows):
        # 1. Verify prev_hash matches expected predecessor
        if row["prev_hash"] != expected_prev:
            logger.error(f"Audit chain BROKEN at ID {row['id']}: prev_hash mismatch! Found {row['prev_hash']}, Expected {expected_prev}")
            return {
                "status": "error",
                "chain_intact": False,
                "total_entries": len(rows),
                "tamper_detected": True,
                "tamper_index": row["id"],
                "tampered_row": dict(row),
                "message": f"Cryptographic integrity violation: prev_hash mismatch at Block ID {row['id']}."
            }

        # 2. Recompute current hash
        recomputed_hash = calculate_entry_hash(
            row["prev_hash"],
            row["timestamp"],
            row["actor"],
            row["action_type"],
            row["action_detail"]
        )

        if recomputed_hash != row["this_hash"]:
            logger.error(f"Audit chain BROKEN at ID {row['id']}: hash mismatch! Found {row['this_hash']}, Recomputed {recomputed_hash}")
            return {
                "status": "error",
                "chain_intact": False,
                "total_entries": len(rows),
                "tamper_detected": True,
                "tamper_index": row["id"],
                "tampered_row": dict(row),
                "message": f"Cryptographic integrity violation: content hash mismatch at Block ID {row['id']}."
            }

        expected_prev = row["this_hash"]

    return {
        "status": "success",
        "chain_intact": True,
        "total_entries": len(rows),
        "genesis_prev_hash": GENESIS_PREV_HASH,
        "latest_hash": rows[-1]["this_hash"],
        "tamper_detected": False,
        "tamper_index": None,
        "message": f"Audit ledger verified. Cryptographic hash chain intact across all {len(rows)} recorded block(s)."
    }


def get_recent_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns the most recent audit log entries in reverse chronological order."""
    init_audit_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, timestamp, actor, action_type, action_detail, prev_hash, this_hash FROM audit_log ORDER BY id DESC LIMIT ?;", (limit,))
        rows = cursor.fetchall()
    return [dict(r) for r in rows]
