import logging
from typing import Dict, Any, List, Set, Tuple
import jellyfish
from rapidfuzz import fuzz
from database import db

logger = logging.getLogger(__name__)


class DisjointSetUnion:
    """Disjoint Set Union (Union-Find) with path compression for safe entity resolution."""
    def __init__(self):
        self.parent: Dict[str, str] = {}

    def find(self, item: str) -> str:
        if item not in self.parent:
            self.parent[item] = item
            return item
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, item1: str, item2: str) -> None:
        root1 = self.find(item1)
        root2 = self.find(item2)
        if root1 != root2:
            self.parent[root2] = root1

    def get_groups(self) -> List[Set[str]]:
        groups: Dict[str, Set[str]] = {}
        for item in list(self.parent.keys()):
            root = self.find(item)
            groups.setdefault(root, set()).add(item)
        return [grp for grp in groups.values() if len(grp) > 1]


def pick_canonical_from_group(names: Set[str]) -> Tuple[str, List[str]]:
    """
    Selects the most complete, authoritative name as canonical from a cluster of aliases.
    (Prefers longest name, fewest periods, title-cased over all-caps).
    Returns (canonical_name, list_of_aliases).
    """
    def score_name(n: str) -> Tuple[int, int, int]:
        clean = n.replace('.', '').strip()
        is_mixed_case = 1 if not n.isupper() and not n.islower() else 0
        return (len(clean), is_mixed_case, -n.count('.'))

    canonical = max(names, key=score_name)
    aliases = [n for n in names if n != canonical]
    return canonical, aliases


def merge_alias_into_canonical(canonical_name: str, alias_name: str) -> None:
    """
    Manual relationship-redirect merge in pure Cypher.
    Redirects OWNS_ACCOUNT, OWNS_PHONE, and ASSOCIATED_WITH edges to canonical,
    appends alias_name to canonical.aliases array, and detaches the duplicate alias node.
    """
    if not canonical_name or not alias_name or canonical_name == alias_name:
        return

    query = """
    MATCH (alias:Person {name: $alias})
    MATCH (canonical:Person {name: $canonical})
    WHERE elementId(alias) <> elementId(canonical)
    
    // Redirect Bank Accounts
    OPTIONAL MATCH (alias)-[:OWNS_ACCOUNT]->(acc:BankAccount)
    FOREACH (_ IN CASE WHEN acc IS NOT NULL THEN [1] ELSE [] END | 
        MERGE (canonical)-[:OWNS_ACCOUNT]->(acc)
    )
    
    // Redirect Phone Numbers (OWNS_PHONE / HAS_PHONE)
    OPTIONAL MATCH (alias)-[:OWNS_PHONE]->(phone:PhoneNumber)
    FOREACH (_ IN CASE WHEN phone IS NOT NULL THEN [1] ELSE [] END | 
        MERGE (canonical)-[:OWNS_PHONE]->(phone)
    )
    OPTIONAL MATCH (alias)-[:HAS_PHONE]->(phone2:PhoneNumber)
    FOREACH (_ IN CASE WHEN phone2 IS NOT NULL THEN [1] ELSE [] END | 
        MERGE (canonical)-[:OWNS_PHONE]->(phone2)
    )
    
    // Redirect Outgoing ASSOCIATED_WITH relationships
    OPTIONAL MATCH (alias)-[r1:ASSOCIATED_WITH]->(other)
    FOREACH (_ IN CASE WHEN other IS NOT NULL AND other <> canonical THEN [1] ELSE [] END | 
        MERGE (canonical)-[:ASSOCIATED_WITH]->(other)
    )
    
    // Redirect Incoming ASSOCIATED_WITH relationships
    OPTIONAL MATCH (other)-[r2:ASSOCIATED_WITH]->(alias)
    FOREACH (_ IN CASE WHEN other IS NOT NULL AND other <> canonical THEN [1] ELSE [] END | 
        MERGE (other)-[:ASSOCIATED_WITH]->(canonical)
    )
    
    // Consolidate aliases property without losing prior alias list
    WITH canonical, alias,
         coalesce(canonical.aliases, []) + [alias.name] + coalesce(alias.aliases, []) AS combined_aliases
    UNWIND combined_aliases AS single_alias
    WITH canonical, alias, collect(DISTINCT single_alias) AS distinct_aliases
    SET canonical.aliases = [a IN distinct_aliases WHERE a <> canonical.name]
    
    // Delete duplicate alias node
    DETACH DELETE alias
    """
    try:
        db.execute_query(query, {"canonical": canonical_name, "alias": alias_name})
        logger.info(f"Merged alias '{alias_name}' into canonical Person '{canonical_name}'")
    except Exception as e:
        logger.warning(f"Merge error for '{alias_name}' -> '{canonical_name}': {e}")


def blocking_keys(name: str) -> Set[str]:
    """
    Generates multiple phonetic blocking keys for a name (both surname and firstname Soundex),
    ensuring abbreviated variants like 'Yahvi K.' and full names like 'Yahvi Kala' are placed
    in the same candidate block.
    """
    if not name or not isinstance(name, str):
        return set()
    tokens = [t.strip('.') for t in name.strip().split() if t.strip('.')]
    keys = set()
    if tokens:
        # Last-token soundex (catches surname variations)
        keys.add(f"LAST_{jellyfish.soundex(tokens[-1])}")
        # First-token soundex (catches 'Firstname L.' patterns)
        keys.add(f"FIRST_{jellyfish.soundex(tokens[0])}")
    return keys


def resolve_person_entities() -> Dict[str, Any]:
    """
    Executes 3-Tier Multi-Modal Entity Resolution in exact priority order using Union-Find:
    - PASS 1: Deterministic merge via shared phone number (OWNS_PHONE / HAS_PHONE)
    - PASS 2: Deterministic merge via shared bank account (OWNS_ACCOUNT)
    - PASS 3: Fuzzy name matching with dual Soundex blocking & token_sort_ratio >= 80
    """
    logger.info("Executing 3-Tier Entity Resolution...")
    dsu = DisjointSetUnion()

    # PASS 1: Deterministic merge via shared phone number
    query_phone = """
    MATCH (p1:Person)-[:OWNS_PHONE|HAS_PHONE]->(ph:PhoneNumber)<-[:OWNS_PHONE|HAS_PHONE]-(p2:Person)
    WHERE elementId(p1) < elementId(p2)
    RETURN p1.name AS name1, p2.name AS name2
    """
    phone_pairs = db.execute_query(query_phone)
    for pair in phone_pairs:
        n1, n2 = pair.get("name1"), pair.get("name2")
        if n1 and n2 and n1 != n2:
            dsu.union(n1, n2)

    # PASS 2: Deterministic merge via shared bank account
    query_account = """
    MATCH (p1:Person)-[:OWNS_ACCOUNT]->(acc:BankAccount)<-[:OWNS_ACCOUNT]-(p2:Person)
    WHERE elementId(p1) < elementId(p2)
    RETURN p1.name AS name1, p2.name AS name2
    """
    account_pairs = db.execute_query(query_account)
    for pair in account_pairs:
        n1, n2 = pair.get("name1"), pair.get("name2")
        if n1 and n2 and n1 != n2:
            dsu.union(n1, n2)

    deterministic_pairs_count = len(phone_pairs) + len(account_pairs)
    logger.info(f"Pass 1 & 2 Complete: {deterministic_pairs_count} deterministic phone/account pairs gathered.")

    # PASS 3: Fuzzy name matching for remaining persons
    remaining = db.execute_query("MATCH (p:Person) RETURN p.name AS name")
    names = [r["name"] for r in remaining if r and r.get("name")]

    blocks: Dict[str, Set[str]] = {}
    for name in names:
        for key in blocking_keys(name):
            blocks.setdefault(key, set()).add(name)

    fuzzy_pairs_count = 0
    checked_pairs = set()

    for block_key, block_names in blocks.items():
        block_list = list(block_names)
        for i, n1 in enumerate(block_list):
            for n2 in block_list[i+1:]:
                pair_key = tuple(sorted([n1, n2]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)
                
                # Compare similarity with token sort ratio
                if fuzz.token_sort_ratio(n1, n2) >= 80:
                    dsu.union(n1, n2)
                    fuzzy_pairs_count += 1

    logger.info(f"Pass 3 Complete: {fuzzy_pairs_count} fuzzy name candidate pairs linked.")

    # Execute Safe Clustered Merges via DSU
    merge_groups = dsu.get_groups()
    total_aliases_merged = 0

    for group in merge_groups:
        canonical, aliases = pick_canonical_from_group(group)
        for alias in aliases:
            merge_alias_into_canonical(canonical, alias)
            total_aliases_merged += 1

    logger.info(f"Entity Resolution Finished: {len(merge_groups)} canonical groups formed, {total_aliases_merged} aliases unified.")

    return {
        "status": "success",
        "deterministic_merges": deterministic_pairs_count,
        "fuzzy_merges": fuzzy_pairs_count,
        "groups_formed": len(merge_groups),
        "aliases_unified": total_aliases_merged
    }
