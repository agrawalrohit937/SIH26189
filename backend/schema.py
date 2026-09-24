import logging
from database import db

logger = logging.getLogger(__name__)

# Constraint and index statements for Neo4j 5.x+
SCHEMA_STATEMENTS = [
    # Unique constraint on PhoneNumber.number
    """
    CREATE CONSTRAINT constraint_phone_number_unique IF NOT EXISTS
    FOR (p:PhoneNumber) REQUIRE p.number IS UNIQUE
    """,
    # Unique constraint on BankAccount.account_id
    """
    CREATE CONSTRAINT constraint_bank_account_unique IF NOT EXISTS
    FOR (b:BankAccount) REQUIRE b.account_id IS UNIQUE
    """,
    # Unique constraint or Index on Person.name
    """
    CREATE CONSTRAINT constraint_person_name_unique IF NOT EXISTS
    FOR (p:Person) REQUIRE p.name IS UNIQUE
    """,
    # Index on Bank Transfer date for fast range/smurfing queries
    """
    CREATE INDEX index_transfer_date IF NOT EXISTS
    FOR ()-[r:TRANSFERRED_TO]-() ON (r.date)
    """,
    # Index on Call timestamp
    """
    CREATE INDEX index_call_timestamp IF NOT EXISTS
    FOR ()-[r:CALLED]-() ON (r.timestamp)
    """
]


def enforce_schema() -> None:
    """
    Executes constraints and index definitions to enforce the graph schema.
    Runs on FastAPI application startup.
    """
    logger.info("Enforcing Neo4j Graph schema constraints and indexes...")
    for statement in SCHEMA_STATEMENTS:
        try:
            db.execute_query(statement.strip())
        except Exception as e:
            logger.warning(f"Schema execution notice: {e}")
    logger.info("Neo4j Graph schema constraints and indexes enforced successfully.")
