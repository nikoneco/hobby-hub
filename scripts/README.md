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
