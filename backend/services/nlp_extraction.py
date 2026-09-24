import os
import json
import logging
from typing import Dict, Any, List
from groq import Groq
from config import get_settings
from database import db

logger = logging.getLogger(__name__)


def process_fir_text(file_path: str = "FIR_Case_992.txt") -> Dict[str, Any]:
    """
    Reads FIR case text, uses Groq LLM (openai/gpt-oss-20b) to extract structured
    criminal intelligence (suspects, associates, phone numbers), and merges them into Neo4j
    with [:OWNS_PHONE] and [:ASSOCIATED_WITH] edges.
    """
    if not os.path.exists(file_path):
        candidate = os.path.join("e:/SIH26189", file_path)
        if os.path.exists(candidate):
            file_path = candidate
        else:
            raise FileNotFoundError(f"FIR file not found at: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        fir_text = f.read()

    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set in configuration or .env file.")

    client = Groq(api_key=settings.GROQ_API_KEY)

    system_prompt = """
You are an expert law enforcement intelligence analyst specializing in Indian police FIR documents.
Analyze the provided FIR text and extract all entities into a strict JSON object.

Extract:
1. "persons": list of person entities mentioned, each containing:
   - "name": Full name or primary alias used in FIR (standardize e.g. "Aman Verma" or "Vikram Singh")
   - "aliases": list of other aliases/nicknames mentioned (e.g. ["Vikram Bhai", "Vikram S."])
   - "role": "Suspect", "Associate", "Complainant", or "Witness"
   - "phone_numbers": list of 10-digit phone numbers linked to this person
2. "phone_associations": list of direct mappings:
   - "person_name": name of the person
   - "phone_number": string
3. "associates": list of relationships between persons:
   - "person1": name
   - "person2": name
   - "relationship": description (e.g. "henchman", "associate", "extortion_collector")

Respond ONLY with valid JSON matching this schema. Do not include markdown ticks or commentary.
"""

    logger.info(f"Extracting entities from FIR using Groq openai/gpt-oss-20b...")

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the FIR text:\n\n{fir_text}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.1
    )

    extracted_content = response.choices[0].message.content
    extracted_data = json.loads(extracted_content)

    logger.info(f"Groq Extraction Result: {json.dumps(extracted_data, indent=2)}")

    # Ingest extracted intelligence into Neo4j
    # 1. Merge Persons
    merge_persons_query = """
    UNWIND $persons AS p
    MERGE (person:Person {name: p.name})
    SET person.role = p.role,
        person.aliases = p.aliases
    """
    if extracted_data.get("persons"):
        db.execute_query(merge_persons_query, {"persons": extracted_data["persons"]})

    # 2. Merge Phone Numbers and [:OWNS_PHONE] edges
    merge_phones_query = """
    UNWIND $associations AS assoc
    MERGE (person:Person {name: assoc.person_name})
    MERGE (phone:PhoneNumber {number: assoc.phone_number})
    MERGE (person)-[:OWNS_PHONE]->(phone)
    """
    associations: List[Dict[str, str]] = extracted_data.get("phone_associations", [])
    # Also derive associations from persons list if not explicitly populated
    for p in extracted_data.get("persons", []):
        for ph in p.get("phone_numbers", []):
            associations.append({"person_name": p["name"], "phone_number": ph})

    # Deduplicate associations
    unique_associations = [dict(t) for t in {tuple(d.items()) for d in associations}]
    if unique_associations:
        db.execute_query(merge_phones_query, {"associations": unique_associations})

    # 3. Merge [:ASSOCIATED_WITH] edges if extracted
    merge_associates_query = """
    UNWIND $associates AS assoc
    MERGE (p1:Person {name: assoc.person1})
    MERGE (p2:Person {name: assoc.person2})
    MERGE (p1)-[:ASSOCIATED_WITH {relationship: assoc.relationship}]->(p2)
    """
    if extracted_data.get("associates"):
        db.execute_query(merge_associates_query, {"associates": extracted_data["associates"]})

    return {
        "status": "success",
        "file": file_path,
        "extracted_intelligence": extracted_data,
        "nodes_merged": len(extracted_data.get("persons", [])),
        "phone_links_created": len(unique_associations)
    }
