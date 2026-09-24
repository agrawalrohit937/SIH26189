import os
import re
import json
import logging
from typing import Dict, Any, List, Optional, Union
from groq import Groq
from config import get_settings
from database import db

logger = logging.getLogger(__name__)


def extract_entities_rule_based(fir_text: str) -> Dict[str, Any]:
    """
    Robust rule-based intelligence extraction from FIR text.
    Extracts accused, suspects, associates, phone numbers, accounts, and relationships
    dynamically from the actual text content without any hardcoded mock data.
    """
    persons: List[Dict[str, Any]] = []
    phone_associations: List[Dict[str, str]] = []
    associates: List[Dict[str, str]] = []

    lines = fir_text.splitlines()
    current_person: Optional[Dict[str, Any]] = None

    # Pattern matchers
    phone_pattern = re.compile(r'(?:\+91[\s-]?)?([6-9]\d{9})')
    account_pattern = re.compile(r'(?:Account|Acc|A/c)[:\s]*([A-Za-z0-9_]{6,20})', re.IGNORECASE)

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Check for suspect / accused / associate headers
        suspect_match = re.search(r'(?:Accused|Suspect|Associate|Witness|Complainant)\s*(?:\d+)?[:.-]\s*(.+)', line_clean, re.IGNORECASE)
        if suspect_match:
            raw_entry = suspect_match.group(1).strip()
            
            # Check for canonical name specification: e.g. "J. Sibal (Canonical: Jagrati Sibal)"
            canonical_match = re.search(r'\(Canonical[:\s]+([^)]+)\)', raw_entry, re.IGNORECASE)
            if canonical_match:
                canonical_name = canonical_match.group(1).strip()
                alias_candidate = re.sub(r'\(Canonical[:\s]+[^)]+\)', '', raw_entry).strip()
            else:
                canonical_name = raw_entry.split('(')[0].strip()
                alias_candidate = raw_entry

            role = "Suspect"
            if re.search(r'Associate', line_clean, re.IGNORECASE):
                role = "Associate"
            elif re.search(r'Witness', line_clean, re.IGNORECASE):
                role = "Witness"
            elif re.search(r'Complainant', line_clean, re.IGNORECASE):
                role = "Complainant"

            aliases = []
            if alias_candidate and alias_candidate != canonical_name:
                aliases.append(alias_candidate)

            current_person = {
                "name": canonical_name,
                "aliases": aliases,
                "role": role,
                "phone_numbers": []
            }
            persons.append(current_person)
            continue

        # Check for alias in sub-line: "Alias: J. Sibal"
        alias_match = re.search(r'Alias(?:es)?[:\s]+(.+)', line_clean, re.IGNORECASE)
        if alias_match and current_person:
            alias_val = alias_match.group(1).strip()
            if alias_val not in current_person["aliases"] and alias_val != current_person["name"]:
                current_person["aliases"].append(alias_val)

        # Check for role in sub-line: "Role: Syndicate Lead"
        role_match = re.search(r'Role[:\s]+(.+)', line_clean, re.IGNORECASE)
        if role_match and current_person:
            current_person["role"] = role_match.group(1).strip()

        # Check for phone numbers in line
        phones = phone_pattern.findall(line_clean)
        for ph in phones:
            if current_person:
                if ph not in current_person["phone_numbers"]:
                    current_person["phone_numbers"].append(ph)
                phone_associations.append({
                    "person_name": current_person["name"],
                    "phone_number": ph
                })

    # If no persons were structured by header, scan general text for persons & phone associations
    if not persons:
        all_phones = phone_pattern.findall(fir_text)
        # Look for capitalized 2-3 word entity names
        name_candidates = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b', fir_text)
        unique_names = list(dict.fromkeys(name_candidates))[:5]
        for idx, n in enumerate(unique_names):
            p_phones = [all_phones[idx]] if idx < len(all_phones) else []
            persons.append({
                "name": n,
                "aliases": [],
                "role": "Suspect" if idx == 0 else "Associate",
                "phone_numbers": p_phones
            })
            for ph in p_phones:
                phone_associations.append({
                    "person_name": n,
                    "phone_number": ph
                })

    # Associate multiple persons if found
    for i in range(len(persons) - 1):
        associates.append({
            "person1": persons[i]["name"],
            "person2": persons[i+1]["name"],
            "relationship": "associate"
        })

    return {
        "persons": persons,
        "phone_associations": phone_associations,
        "associates": associates
    }


def process_fir_text(
    file_source: Optional[Union[str, bytes]] = None,
    file_path: Optional[str] = None,
    raw_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Reads FIR case text from file, bytes, or string.
    Uses Groq LLM (openai/gpt-oss-20b) to extract structured criminal intelligence,
    falling back to intelligent regex-based dynamic extraction on the actual text.
    Merges entities into Neo4j with [:OWNS_PHONE] and [:ASSOCIATED_WITH] edges.
    """
    fir_text = ""
    source_label = "FIR_Case_Text"

    if raw_text:
        fir_text = raw_text
        source_label = "Direct Text Input"
    elif isinstance(file_source, bytes):
        fir_text = file_source.decode('utf-8', errors='replace')
        source_label = "Uploaded FIR File"
    elif isinstance(file_source, str) and not os.path.exists(file_source) and len(file_source) > 50 and "\n" in file_source:
        fir_text = file_source
        source_label = "Direct Text Content"
    else:
        target_path = file_path or (file_source if isinstance(file_source, str) else "FIR_Case_992.txt")
        if not os.path.exists(target_path):
            candidate = os.path.join("backend", target_path)
            if os.path.exists(candidate):
                target_path = candidate
            else:
                candidate_root = os.path.join("e:/SIH26189", target_path)
                if os.path.exists(candidate_root):
                    target_path = candidate_root
                else:
                    raise FileNotFoundError(f"FIR file not found at: {target_path}")

        source_label = target_path
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            fir_text = f.read()

    if not fir_text.strip():
        raise ValueError("Provided FIR text is empty.")

    settings = get_settings()
    extracted_data = None

    # Attempt Groq LLM extraction if API key is present
    if settings.GROQ_API_KEY:
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            system_prompt = """You are an expert law enforcement intelligence analyst specializing in Indian police FIR documents.
Analyze the provided FIR text and extract all entities into a valid JSON object with the following structure:
{
  "persons": [
    {
      "name": "Full name or primary alias",
      "aliases": ["list of other aliases"],
      "role": "Suspect | Associate | Complainant | Witness",
      "phone_numbers": ["10-digit phone numbers"]
    }
  ],
  "phone_associations": [
    {
      "person_name": "Full name",
      "phone_number": "10-digit string"
    }
  ],
  "associates": [
    {
      "person1": "Name 1",
      "person2": "Name 2",
      "relationship": "associate | henchman | etc"
    }
  ]
}
Respond strictly with valid JSON only. Do not wrap in markdown or add conversational commentary."""

            logger.info(f"Extracting entities from FIR using Groq openai/gpt-oss-20b...")
            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract all intelligence from this FIR into a strict JSON object:\n\n{fir_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            extracted_content = response.choices[0].message.content.strip()

            if extracted_content.startswith("```"):
                lines = extracted_content.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                extracted_content = "\n".join(lines).strip()

            extracted_data = json.loads(extracted_content)
        except Exception as e:
            logger.warning(f"Groq LLM extraction failed ({e}). Falling back to dynamic rule-based extractor.")

    # Dynamic rule-based fallback if LLM was unavailable or failed
    if not extracted_data or not isinstance(extracted_data, dict) or "persons" not in extracted_data:
        logger.info("Executing dynamic rule-based intelligence extraction from FIR text...")
        extracted_data = extract_entities_rule_based(fir_text)

    logger.info(f"Intelligence Extraction Result: {json.dumps(extracted_data, indent=2)}")

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
    associations: List[Dict[str, str]] = list(extracted_data.get("phone_associations", []))
    for p in extracted_data.get("persons", []):
        for ph in p.get("phone_numbers", []):
            associations.append({"person_name": p["name"], "phone_number": ph})

    if associations:
        unique_associations = [dict(t) for t in {tuple(d.items()) for d in associations if d.get("person_name") and d.get("phone_number")}]
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
        "file": source_label,
        "extracted_intelligence": extracted_data,
        "total_persons_extracted": len(extracted_data.get("persons", [])),
        "total_phones_linked": len(associations)
    }
