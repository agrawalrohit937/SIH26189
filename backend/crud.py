from typing import Any, Dict, List, Optional
from database import db


# ==============================================================================
# 1. PERSON CRUD
# ==============================================================================
def create_person(name: str, role: Optional[str] = None, aliases: Optional[List[str]] = None) -> Dict[str, Any]:
    query = """
    MERGE (p:Person {name: $name})
    SET p.role = $role, p.aliases = $aliases
    RETURN p.name AS name, p.role AS role, p.aliases AS aliases
    """
    res = db.execute_query(query, {"name": name, "role": role, "aliases": aliases or []})
    return res[0] if res else {}


def get_person(name: str) -> Optional[Dict[str, Any]]:
    query = """
    MATCH (p:Person {name: $name})
    OPTIONAL MATCH (p)-[:OWNS_PHONE]->(ph:PhoneNumber)
    OPTIONAL MATCH (p)-[:OWNS_ACCOUNT]->(acc:BankAccount)
    RETURN p.name AS name, p.role AS role, p.aliases AS aliases,
           collect(DISTINCT ph.number) AS phone_numbers,
           collect(DISTINCT acc.account_id) AS bank_accounts
    """
    res = db.execute_query(query, {"name": name})
    return res[0] if res else None


def update_person(name: str, new_role: Optional[str] = None, aliases: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    query = """
    MATCH (p:Person {name: $name})
    SET p.role = coalesce($new_role, p.role),
        p.aliases = coalesce($aliases, p.aliases)
    RETURN p.name AS name, p.role AS role, p.aliases AS aliases
    """
    res = db.execute_query(query, {"name": name, "new_role": new_role, "aliases": aliases})
    return res[0] if res else None


def delete_person(name: str) -> bool:
    query = """
    MATCH (p:Person {name: $name})
    DETACH DELETE p
    RETURN count(p) AS deleted_count
    """
    res = db.execute_query(query, {"name": name})
    return res[0]["deleted_count"] > 0 if res else False


# ==============================================================================
# 2. PHONENUMBER CRUD
# ==============================================================================
def create_phone_number(number: str, carrier: Optional[str] = None) -> Dict[str, Any]:
    query = """
    MERGE (p:PhoneNumber {number: $number})
    SET p.carrier = $carrier
    RETURN p.number AS number, p.carrier AS carrier
    """
    res = db.execute_query(query, {"number": number, "carrier": carrier})
    return res[0] if res else {}


def get_phone_number(number: str) -> Optional[Dict[str, Any]]:
    query = """
    MATCH (p:PhoneNumber {number: $number})
    OPTIONAL MATCH (p)<-[:OWNS_PHONE]-(owner:Person)
    RETURN p.number AS number, p.carrier AS carrier, owner.name AS owner_name
    """
    res = db.execute_query(query, {"number": number})
    return res[0] if res else None


def delete_phone_number(number: str) -> bool:
    query = """
    MATCH (p:PhoneNumber {number: $number})
    DETACH DELETE p
    RETURN count(p) AS deleted_count
    """
    res = db.execute_query(query, {"number": number})
    return res[0]["deleted_count"] > 0 if res else False


# ==============================================================================
# 3. BANKACCOUNT CRUD
# ==============================================================================
def create_bank_account(account_id: str, bank_name: Optional[str] = None) -> Dict[str, Any]:
    query = """
    MERGE (b:BankAccount {account_id: $account_id})
    SET b.bank_name = $bank_name
    RETURN b.account_id AS account_id, b.bank_name AS bank_name
    """
    res = db.execute_query(query, {"account_id": account_id, "bank_name": bank_name})
    return res[0] if res else {}


def get_bank_account(account_id: str) -> Optional[Dict[str, Any]]:
    query = """
    MATCH (b:BankAccount {account_id: $account_id})
    OPTIONAL MATCH (owner:Person)-[:OWNS_ACCOUNT]->(b)
    RETURN b.account_id AS account_id, b.bank_name AS bank_name, owner.name AS owner_name
    """
    res = db.execute_query(query, {"account_id": account_id})
    return res[0] if res else None


def delete_bank_account(account_id: str) -> bool:
    query = """
    MATCH (b:BankAccount {account_id: $account_id})
    DETACH DELETE b
    RETURN count(b) AS deleted_count
    """
    res = db.execute_query(query, {"account_id": account_id})
    return res[0]["deleted_count"] > 0 if res else False


# ==============================================================================
# 4. RELATIONSHIP CRUD: (PhoneNumber)-[:CALLED]->(PhoneNumber)
# ==============================================================================
def create_call_relationship(caller: str, receiver: str, timestamp: str, duration: int, tower: str) -> Dict[str, Any]:
    query = """
    MERGE (c:PhoneNumber {number: $caller})
    MERGE (r:PhoneNumber {number: $receiver})
    CREATE (c)-[rel:CALLED {timestamp: $timestamp, duration: $duration, tower: $tower}]->(r)
    RETURN c.number AS caller, r.number AS receiver, rel.timestamp AS timestamp, rel.duration AS duration, rel.tower AS tower
    """
    res = db.execute_query(query, {
        "caller": caller,
        "receiver": receiver,
        "timestamp": timestamp,
        "duration": duration,
        "tower": tower
    })
    return res[0] if res else {}


# ==============================================================================
# 5. RELATIONSHIP CRUD: (BankAccount)-[:TRANSFERRED_TO]->(BankAccount)
# ==============================================================================
def create_transfer_relationship(sender_acc: str, receiver_acc: str, amount: float, date: str, remarks: str) -> Dict[str, Any]:
    query = """
    MERGE (s:BankAccount {account_id: $sender_acc})
    MERGE (r:BankAccount {account_id: $receiver_acc})
    CREATE (s)-[rel:TRANSFERRED_TO {amount: $amount, date: $date, remarks: $remarks}]->(r)
    RETURN s.account_id AS sender, r.account_id AS receiver, rel.amount AS amount, rel.date AS date, rel.remarks AS remarks
    """
    res = db.execute_query(query, {
        "sender_acc": sender_acc,
        "receiver_acc": receiver_acc,
        "amount": amount,
        "date": date,
        "remarks": remarks
    })
    return res[0] if res else {}


# ==============================================================================
# 6. RELATIONSHIP CRUD: (Person)-[:OWNS_PHONE]->(PhoneNumber)
# ==============================================================================
def link_person_to_phone(person_name: str, phone_number: str) -> Dict[str, Any]:
    query = """
    MERGE (p:Person {name: $person_name})
    MERGE (ph:PhoneNumber {number: $phone_number})
    MERGE (p)-[r:OWNS_PHONE]->(ph)
    RETURN p.name AS person, ph.number AS phone_number
    """
    res = db.execute_query(query, {"person_name": person_name, "phone_number": phone_number})
    return res[0] if res else {}


# ==============================================================================
# 7. RELATIONSHIP CRUD: (Person)-[:OWNS_ACCOUNT]->(BankAccount)
# ==============================================================================
def link_person_to_bank_account(person_name: str, account_id: str) -> Dict[str, Any]:
    query = """
    MERGE (p:Person {name: $person_name})
    MERGE (b:BankAccount {account_id: $account_id})
    MERGE (p)-[r:OWNS_ACCOUNT]->(b)
    RETURN p.name AS person, b.account_id AS account_id
    """
    res = db.execute_query(query, {"person_name": person_name, "account_id": account_id})
    return res[0] if res else {}
