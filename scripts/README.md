# PDF and CSV preparation scripts

These scripts create local CSV files for the GAS import pipeline.

```powershell
$py = "C:\Users\aqua_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py scripts\extract_study_guide.py "737_Study_Finder\Study_Guide\24_REF.pdf" --out-dir data
& $py scripts\extract_question_bank.py "737_Study_Finder\標準問題集\737-800標準問題集(2012.03.13).pdf" --out-dir data
node scripts\generate_answer_drafts.js 24
node scripts\build_prepared_gas_data.js 24
```

Outputs are ATA-scoped, for example:

- `data/textbook_pages_ata24.csv`
- `data/textbook_sections_ata24.csv`
- `data/question_bank_ata24.csv`
- `data/question_bank_ata24_prepared.csv`
- `data/candidate_links_ata24.csv`
- `data/answer_notes_ata24.csv`
- `737_Study_Finder/gas/PreparedAta24Data.gs`

Generated CSV files are intentionally ignored by Git.
`PreparedAta24Data.gs` is generated from those CSVs and is committed so the Study app can import ATA24 data without manual CSV upload.
