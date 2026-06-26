# 趣味HUB

Google Apps Script Web App + Google Sheetsで作る趣味アプリ群の入口です。

## 構成

- `gas/`
  - 趣味HUB本体。
  - 各アプリへのリンク集/ランチャー専用。
  - `HobbyHub_Master` の `hub_modules` を読んでアプリ一覧を表示します。
- `737_Study_Finder/gas/`
  - 737 Study Finder本体。
  - `Study737_DB` を使って、問題、参照ページ、候補ページ、AI下書き回答、確定回答を管理します。
- `IzakayaScout/gas/`
  - 居酒屋Scout本体。
  - 駅名・地名やGoogle Maps側の現在地解釈を使って、居酒屋検索URLを生成する無課金MVPです。
- `IzakayaScoutHP/gas/`
  - 居酒屋ScoutHP本体。
  - Hot Pepper Gourmet Web Service APIで店候補をアプリ内に表示する試作版です。
- `scripts/`
  - PDFからCSVを作る抽出スクリプト。
  - 抽出済みCSVから候補ページとAI回答下書きCSVを作る補助スクリプト。
- `737_Study_Finder/data/`
  - Study Finder用の生成CSV置き場。Git管理対象外です。

## Drive / Apps Script

### 趣味HUB

- Script URL: https://script.google.com/d/1zeYJdhMTa4odr3SXLFv6ns0LOg2zmAJeOPxYUjbnACDN8o5oeYtRmzaI/edit
- Web App URL: https://script.google.com/macros/s/AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1/exec
- Spreadsheet: https://docs.google.com/spreadsheets/d/1jMJdrYongZ9_mF_2i82g65Hh-0nTHztVusYpg8vEx_A/edit
- Local root: `gas/`

### 737 Study Finder

- Script URL: https://script.google.com/d/1qOkLEui2ZCfWIAEsW7AW7v4ZwZFl8K1i6UtWG1_LaayRR4eFf6DLM1K-/edit
- Web App URL: https://script.google.com/macros/s/AKfycbzPwkINDY--2PUYQg5xGoPDtkCLYvGoItobfEJocINxBFviRzcCrxb7Iu5lylirQ7tLOg/exec
- Spreadsheet: https://docs.google.com/spreadsheets/d/11YODNUHgln3dL_wADeR7va4EfAltIzY68lQxNGvBpto/edit
- Local root: `737_Study_Finder/gas/`

### 居酒屋Scout

- Drive folder: https://drive.google.com/drive/folders/1RD2Hbp3n4C1f9HgDTPbRyuHCEmqscjvY
- Script URL: https://script.google.com/d/1jOmEUFlVEWq57qdYTWNDXdL5znnQXTaKPyytIbPqAsE_wZ74Uk-NBXuC/edit
- Web App URL: https://script.google.com/macros/s/AKfycbz6JdN9R-WSetCdw4XDlPOTgwWPS8WpqfdlPXKsNEFosEK5pK5suDaJU4v7jLj8H0sE/exec
- Local root: `IzakayaScout/gas/`

### 居酒屋ScoutHP

- Drive folder: https://drive.google.com/drive/folders/1o5UTjEEwogCUxdVL7vEL0bqdBaeAHFwz
- Script URL: https://script.google.com/d/1Q_h7s1zPIiyC7vSq5o9_a_5H1giDsmLzGQTYYrD8QR4R7BkOaPWMw9NP/edit
- Web App URL: https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec
- Local root: `IzakayaScoutHP/gas/`

## CSV準備

```powershell
$py = "C:\Users\aqua_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py scripts\extract_study_guide.py "737_Study_Finder\Study_Guide\24_REF.pdf" --out-dir 737_Study_Finder\data
& $py scripts\extract_question_bank.py "737_Study_Finder\標準問題集\737-800標準問題集(2012.03.13).pdf" --out-dir 737_Study_Finder\data
node scripts\generate_answer_drafts.js 24
node scripts\build_prepared_gas_data.js 24
```

主な出力:

- `737_Study_Finder/data/textbook_pages_ata24.csv`
- `737_Study_Finder/data/textbook_sections_ata24.csv`
- `737_Study_Finder/data/question_bank_ata24.csv`
- `737_Study_Finder/data/question_bank_ata24_prepared.csv`
- `737_Study_Finder/data/candidate_links_ata24.csv`
- `737_Study_Finder/data/answer_notes_ata24.csv`

## 運用メモ

- 他ATAを追加するときは、同じCSVスキーマで `ata` 列を分けます。
- ATA24の初期データは `737_Study_Finder/gas/PreparedAta24Data.gs` に同梱できます。
- Studyアプリの `ATA24準備データ取込` ボタン、または `?action=importAta24` でCSV選択なしに一括投入します。
- AI下書きは `answer_notes` に保存します。
- ユーザーが確認・修正して採用した回答だけを `confirmed_answers` に保存します。
- 外部AI APIは使いません。ChatGPT/Codexで作った下書きやローカル抽出テキスト由来の下書きを、CSVまたは画面から取り込みます。
