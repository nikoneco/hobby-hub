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

ATA_PAGE_RE = re.compile(
    r"737-800\s*標準問題\s+JHZ/T\s+737\s+Team\s+(?P<ata>(?:\d{2}|[7７][XxＸｘ]))\s+(?P<title>.+?)\s+Check\s+(?P<body>.*)"
)
CONTINUATION_PAGE_RE = re.compile(r"737-800\s*標準問題\s+JHZ/T\s+737\s+Team\s+(?P<body>.*)")
QUESTION_END_RE = re.compile(
    r"(.*?(?:答えなさい。?|説明しなさい。?|記入しなさい。?|答えられる。?|説明できる。?|述べなさい。?))"
)

DEFAULT_STOP_MARKERS = [
    "AIR CONDITIONING SYSTEM",
    "ELECTRICAL POWER SYSTEM",
    "DC GENERATION SYSTEM",
    "EXTERNAL POWER",
    "GENERATOR DRIVE",
    "AC GENERATION SYSTEM",
    "AC ELECTRICAL LOAD DISTRIBUTION",
    "HYDRAULIC POWER SYSTEM",
    "FUEL SYSTEM",
    "STRUCTURES",
    "DOOR",
]

STOP_MARKERS_BY_ATA = {
    "49": [
        "5X STRUCTURES",
        "STRUCTURES",
    ],
}


def normalize_ata_key(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "").strip().upper()
    if text == "7X":
        return "7X"
    return re.sub(r"\D", "", text)


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "")
    text = re.sub(r"[窶・窶停凪披評]", "-", text)
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
    if any(term in normalized for term in ["LIGHT", "SWITCH", "CONDITION"]) or any(term in text for term in ["点灯条件", "作動条件"]):
        return "condition_list"
    if any(term in normalized for term in ["KVA", "VOLT", "AMP", "HZ"]) or "定格" in text:
        return "rating"
    if any(term in normalized for term in ["SERVICE", "PROCEDURE"]) or any(term in text for term in ["要領", "手順"]):
        return "procedure"
    if "FUNCTION" in normalized or "機能" in text:
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


def split_questions(body: str, stop_markers: list[str]) -> list[str]:
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
        question = re.sub(r"^[、。・\s]+", "", match.group(1).strip())
        if question and not question.endswith("。"):
            question += "。"
        if question:
            questions.append(question)
        cursor = cursor[match.end() :].strip()
    return questions


def clean_question_text(question: str, ata: str, section_name: str) -> str:
    cleaned = question.strip()
    prefix = f"{ata} {section_name} "
    if cleaned.startswith(prefix):
        cleaned = cleaned[len(prefix) :].strip()
    return cleaned


def expand_target_specific_questions(question: str, target_ata: str) -> list[str]:
    if target_ata == "49" and "APU CONTROL" in question and "Lub Modle" in question:
        before, after = question.split("APU CONTROL", 1)
        return [
            before.strip(),
            "APU CONTROL " + after.strip(),
        ]
    if target_ata == "26":
        return expand_ata26_questions(question)
    return [question]


def expand_ata26_questions(question: str) -> list[str]:
    replacements = {
        "P8 PNLのAPU Fire HNDLを引くと機体としてどのような状態になるか？ ATA別に整理して説明しなさい。":
            "P8 PNLのAPU Fire HNDLを引くと機体としてどのような状態になるか、ATA別に整理して説明しなさい。",
        "（P8 PNLのAPU Fire HNDLを引く事による Systemの作動を ATA別に整理して説明しなさい。":
            "",
        "） APU Fire Extinguishing Bottleの取扱い注意事項を記入しなさい。":
            "APU Fire Extinguishing Bottleの取扱い注意事項を記入しなさい。",
        "APU Remote Control Panelの機能（できること全て）を記入しなさい。":
            "APU Remote Control Panelの機能（できること全て）を記入しなさい。",
        "分かりますか。 を記入しなさい。":
            "",
    }
    if question in replacements:
        replacement = replacements[question]
        return [replacement] if replacement else []

    if "Engine Fire Extinguishing SYSの主要構成Component" in question and "ENG Fire Extinguishing BTLから" in question:
        return [
            "Engine Fire Extinguishing SYSの主要構成ComponentおよびLocationを記入しなさい。",
            "ENG Fire Extinguishing BTLから噴射されたハロンがENGのどこに噴射されるか記入しなさい。",
        ]
    if "P8 PNLのENG Fire HNDL" in question and "ENG Fire Extinguishing BTLの取扱い注意事項" in question:
        return [
            "P8 PNLのENG Fire HNDLを引く事によるSystemの作動を説明しなさい。",
            "ENG Fire Extinguishing BTLの取扱い注意事項を記入しなさい。",
        ]
    if "APU Fire Extinguishing SYSの主要構成Component" in question:
        return ["APU Fire Extinguishing SYSの主要構成ComponentおよびLocationを記入しなさい。"]
    if "CARGO COMPARTMENT SMOKE DETECTION SYSTEM" in question and "CGO Electronic Unit" in question:
        return [
            "CGO COMP'T Smoke DET SYSの主要構成ComponentおよびLocationを記入しなさい。（FWD/AFTで個数が違う場合にはその個数も記入すること）",
            "CGO Electronic Unitの機能を記入しなさい。",
        ]
    if "APU Fire Extinguishing BTLから" in question:
        return ["APU Fire Extinguishing BTLから噴射されたハロンがAPUのどこに噴射されるか記入しなさい。"]
    if "CARGO COMPARTMENT FIRE EXTINGUISHING SYSTEM" in question and "国内線機/国際線機" in question:
        return [
            "CGO COMP'T Fire Extinguishing SYSの主要構成ComponentおよびLocationを記入しなさい。",
            "Cargo COMP'T Fire Extinguishing SYSの国内線機/国際線機の違いを説明しなさい。",
        ]
    if "LAVATORY SMOKE DETECTION" in question and "Smoke Detector" in question:
        return ["LavatoryのSmoke Detectorの作動原理について、イオン化式とPhotoelectric式を分けて説明しなさい。"]
    if "（イオン化式とPhotoelectric式分別して）" in question and "Fire Extinguishing Bottle" in question:
        return ["LavatoryのFire Extinguishing Bottleの作動及びLocationについて記入しなさい。"]
    if "Wing & Body Duct OVHT DET SYS" in question and "SensorのType" in question:
        return [
            "Wing & Body Duct OVHT DET SYSの主要構成ComponentおよびLocationを記入しなさい。",
            "Wing & Body Duct OVHT DET SensorのTypeおよび検知する原理を記入しなさい。",
        ]
    if "Wing & Body Duct OVHT DET SNSRに不具合" in question:
        return [
            "Wing & Body Duct OVHT DET SNSRに不具合が発生した場合には、どこで分かりますか。",
            "737-800型機の機内に装備されている消火器のType（種類）について記入しなさい。（FWD/AFTで個数が違う場合にはその個数も記入すること）",
        ]
    return [question]


def extract_rows(pdf_path: Path, target_ata: str, source_id: str) -> list[dict[str, str]]:
    reader = PdfReader(str(pdf_path))
    now = datetime.now(timezone.utc).isoformat()
    rows: list[dict[str, str]] = []
    current_ata = ""
    current_section_name = ""
    target_ata = normalize_ata_key(target_ata)
    stop_markers = STOP_MARKERS_BY_ATA.get(target_ata, DEFAULT_STOP_MARKERS)

    for page_number, page in enumerate(reader.pages, start=1):
        text = compact_text(page.extract_text() or "")
        match = ATA_PAGE_RE.search(text)
        if match:
            current_ata = normalize_ata_key(match.group("ata"))
            current_section_name = match.group("title").strip()
            body = match.group("body")
        elif current_ata == target_ata:
            continuation = CONTINUATION_PAGE_RE.search(text)
            body = continuation.group("body") if continuation else text
        else:
            body = ""

        if current_ata != target_ata or not body:
            continue

        questions: list[str] = []
        for question in split_questions(body, stop_markers):
            cleaned_question = clean_question_text(question, target_ata, current_section_name)
            questions.extend(expand_target_specific_questions(cleaned_question, target_ata))
        if target_ata == "26":
            questions = list(dict.fromkeys(questions))

        for question in questions:
            question_type = classify_question(question)
            order = len(rows) + 1
            rows.append(
                {
                    "question_id": stable_question_id(target_ata, question, order),
                    "ata": target_ata,
                    "source_id": source_id,
                    "pdf_page": str(page_number),
                    "section_name": current_section_name,
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
