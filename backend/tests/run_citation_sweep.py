import os
import re

PATTERNS = [
    r'\bRule\b',
    r'\bSection\b',
    r'\bAct\b',
    r'\bPMLA\b',
    r'\bTelegraph\b',
    r'50,?000',
    r'\bIT Act\b',
    r'\bBNS\b',
    r'\bBNSS\b',
    r'\bIPC\b',
    r'\bCrPC\b',
    r'\bCTR\b'
]
COMBINED_REGEX = re.compile('|'.join(PATTERNS), re.IGNORECASE)

EXCLUDE_DIRS = {'.git', 'node_modules', '.next', 'venv', '__pycache__', '.pytest_cache', 'scratch'}

root_dir = r'e:\SIH26189'
findings = []

for root, dirs, files in os.walk(root_dir):
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for file in files:
        if file.endswith(('.py', '.ts', '.tsx', '.js', '.json', '.md')):
            fpath = os.path.join(root, file)
            rel_path = os.path.relpath(fpath, root_dir)
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    for lno, line in enumerate(f, 1):
                        if COMBINED_REGEX.search(line):
                            findings.append((rel_path, lno, line.strip()))
            except Exception as e:
                pass

output_path = os.path.join(os.path.dirname(__file__), "citation_audit_results.txt")
with open(output_path, "w", encoding="utf-8") as out:
    out.write(f"TOTAL MATCHES FOUND: {len(findings)}\n\n")
    for f in findings:
        out.write(f"{f[0]}:{f[1]} -> {f[2]}\n")

print(f"CITATION SWEEP FINISHED: {len(findings)} matches written to {output_path}")
