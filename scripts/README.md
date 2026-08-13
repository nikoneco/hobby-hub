# PDF and CSV preparation scripts

These scripts create local CSV files for the GAS import pipeline.

```powershell
$py = "C:\Users\aqua_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py scripts\extract_study_guide.py "737_Study_Finder\Study_Guide\24_REF.pdf" --out-dir 737_Study_Finder\data
& $py scripts\extract_question_bank.py "737_Study_Finder\標準問題集\737-800標準問題集(2012.03.13).pdf" --out-dir 737_Study_Finder\data
node scripts\generate_answer_drafts.js 24
node scripts\build_prepared_gas_data.js 24
```

If a reviewed answer file exists, `generate_answer_drafts.js` uses it before the extractive draft.
Use one file per ATA so future chapters stay separate, for example:

- `scripts/reviewed_answers_ata24.js`

Outputs are ATA-scoped, for example:

- `737_Study_Finder/data/textbook_pages_ata24.csv`
- `737_Study_Finder/data/textbook_sections_ata24.csv`
- `737_Study_Finder/data/question_bank_ata24.csv`
- `737_Study_Finder/data/question_bank_ata24_prepared.csv`
- `737_Study_Finder/data/candidate_links_ata24.csv`
- `737_Study_Finder/data/answer_notes_ata24.csv`
- `737_Study_Finder/gas/PreparedAta24Data.gs`

Generated CSV files are intentionally ignored by Git.
`PreparedAta24Data.gs` is generated from those CSVs and is committed so the Study app can import ATA24 data without manual CSV upload.

## Question boundary validation

After changing `extract_question_bank.py`, validate the layout exceptions and preserved question IDs against the standard problem collection:

```powershell
$py = "C:\Users\aqua_\AppData\Local\Programs\Python\Python314\python.exe"
& $py scripts\validate_question_extractor.py "737_Study_Finder\標準問題集\737-800標準問題集(2012.03.13).pdf" --data-dir 737_Study_Finder\data
```

The validation covers ATA26 duplicate/line-wrap handling, ATA38 parenthetical question boundaries, and the 7X section header plus contextual questions.

## Sync reviewed Sheet data back to local CSV

The public `Study737_DB` is the canonical copy after questions or answers are reviewed directly in Sheets. Export `source_files`, `question_bank`, `answer_notes`, and `candidate_links` as CSV into `737_Study_Finder/tmp/sheet-sync/`, using these file names:

- `source_files_all.csv`
- `question_bank_all.csv`
- `answer_notes_all.csv`
- `candidate_links_all.csv`

Then sync selected ATA files and rebuild embedded GAS prepared data:

```powershell
node scripts\sync_study_csv_from_sheet_export.js 22 24
node scripts\build_prepared_gas_data.js 22 24
node scripts\validate_study_data.js
```

The sync refuses missing questions, duplicate IDs, duplicate canonical answers, or question/answer count differences.
