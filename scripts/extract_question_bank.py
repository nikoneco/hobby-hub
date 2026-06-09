from __future__ import annotations

import argparse
import csv
import hashlib
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


QUESTION_HEADERS = [
    "question_id",
    "ata",
    "source_id",
    "pdf_page",
    "section_name",
    "subsection_name",
    "question_text",
    "normalized_question",
    "question_type",
    "expected_answer_style",
    "check_status",
    "confirmed_answer_id",
    "created_at",
    "updated_at",
]

ATA_PAGE_RE = re.compile(r"737-800\s+標準問題\s+JHZ/T\s+737\s+Team\s+(?P<ata>\d{2})\s+(?P<title>[A-Z0-9 &/-]+?)\s+Check\s+(?P<body>.*)")
QUESTION_END_RE = re.compile(r"(.*?(?:答えなさい|説明しなさい|説明しなさい。|答えられる|答えられる。|説明できる|説明できる。|要領を説明しなさい|要領を説明しなさい。))")


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "")
    text = re.sub(r"[‐-‒–—―]", "-", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().upper()


def compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def stable_question_id(ata: str, text: str, order: int) -> str:
    digest = hashlib.sha1(f"{ata}:{order}:{normalize_text(text)}".encode("utf-8")).hexdigest()[:12]
    return f"q_{ata}_{digest}"


def classify_question(text: str) -> str:
    normalized = normalize_text(text)
    if "COMPONENT LOCATION" in normalized or ("LOCATION" in normalized and ("FUNCTION" in normalized or "機能" in text)):
        return "component_location_function"
    if any(term in normalized for term in ["LIGHT", "SWITCH", "CONDITION", "点灯条件"]):
        return "condition_list"
    if any(term in normalized for term in ["定格", "KVA", "VOLT", "AMP", "HZ"]):
        return "rating"
    if any(term in normalized for term in ["SERVICE", "要領", "手順"]):
        return "procedure"
    if any(term in normalized for term in ["FUNCTION", "機能"]):
        return "function_list"
    if any(term in normalized for term in ["LOCATION", "PANEL", "MODULE", "COMPONENT"]):
        return "component_location_function"
    return "explanation"


def expected_answer_style(question_type: str, text: str) -> str:
    if question_type in {"function_list", "condition_list"}:
        return "list"
    if question_type == "rating":
        return "component_table"
    if question_type == "procedure":
        return "procedure_steps"
    if "説明" in text:
        return "detailed_explanation"
    return "short_explanation"


def split_questions(body: str) -> list[str]:
    stop_markers = [
        "DC GENERATION SYSTEM",
        "ELECTRICAL POWER SYSTEM",
        "EXTERNAL POWER",
        "GENERATOR DRIVE",
        "AC GENERATION SYSTEM",
        "AC ELECTRICAL LOAD DISTRIBUTION",
    ]
    stop_at = len(body)
    for marker in stop_markers:
        pos = body.find(marker)
        if pos != -1:
            stop_at = min(stop_at, pos)
    body = body[:stop_at].strip()

    questions: list[str] = []
    cursor = body
    while cursor:
        match = QUESTION_END_RE.match(cursor)
        if not match:
            break
        question = match.group(1).strip()
        question = re.sub(r"^[。．\s]+", "", question)
        question = question if question.endswith("。") else question + "。"
        questions.append(question)
        cursor = cursor[match.end() :].strip()
    return questions


def extract_rows(pdf_path: Path, target_ata: str, source_id: str) -> list[dict[str, str]]:
    reader = PdfReader(str(pdf_path))
    now = datetime.now(timezone.utc).isoformat()
    rows: list[dict[str, str]] = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = compact_text(page.extract_text() or "")
        match = ATA_PAGE_RE.search(text)
        if not match or match.group("ata") != target_ata:
            continue
        section_name = match.group("title").strip()
        questions = split_questions(match.group("body"))
        for index, question in enumerate(questions, start=1):
            question_type = classify_question(question)
            rows.append(
                {
                    "question_id": stable_question_id(target_ata, question, index),
                    "ata": target_ata,
                    "source_id": source_id,
                    "pdf_page": str(page_number),
                    "section_name": section_name,
                    "subsection_name": "",
                    "question_text": question,
                    "normalized_question": normalize_text(question),
                    "question_type": question_type,
                    "expected_answer_style": expected_answer_style(question_type, question),
                    "check_status": "unlinked",
                    "confirmed_answer_id": "",
                    "created_at": now,
                    "updated_at": now,
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=QUESTION_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract question bank into CSV.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out-dir", type=Path, default=Path("data"))
    parser.add_argument("--ata", default="24")
    parser.add_argument("--source-id", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_id = args.source_id or f"src_question_bank_{args.ata}"
    rows = extract_rows(args.pdf, args.ata, source_id)
    write_csv(args.out_dir / f"question_bank_ata{args.ata}.csv", rows)
    print(f"question_bank,{len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
