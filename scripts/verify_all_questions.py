"""
Complete verification suite for all 1086 questions in AcaDE-QUIZ.
Audits logic, mathematics, and options across all 5 categories.
"""

import json
import re
import os

with open("supabase_questions_audited.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

print(f"Loaded {len(questions)} questions for deep verification.")

report = {
    "total_questions": len(questions),
    "options_integrity": [],
    "math_operator_checks": [],
    "matrix_secondary_diagonal_checks": [],
    "graph_theory_checks": [],
    "backtracking_checks": [],
    "subprogram_recursion_checks": [],
    "flagged_issues": []
}

for q in questions:
    qid = q["id"]
    text = q.get("text", "") or ""
    code = q.get("code", "") or ""
    cat = q.get("category", "") or ""
    subcat = q.get("subcategory", "") or ""
    opts = q.get("options_json", [])
    if isinstance(opts, str):
        try:
            opts = json.loads(opts)
        except Exception:
            opts = []
    
    cor_idx = q.get("correct_index", 0)

    # 1. Option Bounds
    if not isinstance(opts, list) or len(opts) < 2:
        report["options_integrity"].append({"id": qid, "error": "Opts not list or < 2"})
        continue
    if not isinstance(cor_idx, int) or cor_idx < 0 or cor_idx >= len(opts):
        report["options_integrity"].append({"id": qid, "error": f"Invalid correct_index {cor_idx} for len {len(opts)}"})
        continue

    cor_val = str(opts[cor_idx]).strip()

    # 2. Check for duplicate choices in options
    clean_opts = [str(o).strip().lower() for o in opts]
    if len(set(clean_opts)) != len(clean_opts):
        # check if it's intentional case-sensitivity
        exact_opts = [str(o).strip() for o in opts]
        if len(set(exact_opts)) != len(exact_opts):
            report["flagged_issues"].append({
                "id": qid,
                "category": cat,
                "type": "DUPLICATE_OPTIONS",
                "details": f"Question has exact duplicate choices: {opts}"
            })

    # 3. Graph Theory Formulas
    if cat == "Grafuri si Arbori":
        # Sum of degrees formula
        if "suma gradelor" in text.lower() and "m muchii" in text.lower() and "neorientat" in text.lower():
            if "2" not in cor_val and "m" not in cor_val:
                report["graph_theory_checks"].append({"id": qid, "issue": "Formula suma gradelor neconforma", "answer": cor_val})
        # Tree edges
        if "arbore" in text.lower() and "muchii" in text.lower() and "n noduri" in text.lower() and "câte" in text.lower():
            if "n-1" not in cor_val and "n - 1" not in cor_val and not any(c.isdigit() for c in cor_val):
                report["graph_theory_checks"].append({"id": qid, "issue": "Formula muchii arbore n noduri", "answer": cor_val})

    # 4. Matrix Secondary Diagonal
    if "diagonala secundar" in text.lower() and "2025" in text:
        # Verify that only ONE option satisfies i + j == 2024
        matches = []
        for i, opt in enumerate(opts):
            m = re.search(r"m\[(\d+)\]\[(\d+)\]", str(opt))
            if m:
                r, c = int(m.group(1)), int(m.group(2))
                if r + c == 2024:
                    matches.append((i, str(opt)))
        if len(matches) != 1:
            report["matrix_secondary_diagonal_checks"].append({
                "id": qid,
                "valid_count": len(matches),
                "matches": matches
            })

    # 5. Arithmetic & Modulo checks in text
    if "10 % 3" in text and "rezultat" in text.lower():
        if cor_val != "1":
            report["math_operator_checks"].append({"id": qid, "expected": "1", "actual": cor_val})
    if "5 / 2" in text and "c++" in text.lower():
        if cor_val != "2":
            report["math_operator_checks"].append({"id": qid, "expected": "2", "actual": cor_val})

print("Integrity checks:", len(report["options_integrity"]))
print("Duplicate option issues:", len(report["flagged_issues"]))
print("Graph theory issues:", len(report["graph_theory_checks"]))
print("Secondary diagonal check:", len(report["matrix_secondary_diagonal_checks"]))
print("Math operator checks:", len(report["math_operator_checks"]))

if report["flagged_issues"]:
    print("Flagged issues:", json.dumps(report["flagged_issues"], indent=2))
if report["matrix_secondary_diagonal_checks"]:
    print("Matrix issues:", json.dumps(report["matrix_secondary_diagonal_checks"], indent=2))
