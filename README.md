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
  - Hot Pepper Gourmet Web Service APIで駅名・地名と気分から居酒屋候補を3件に絞ります。
- `scripts/`
  - PDFからCSVを作る抽出スクリプト。
  - 抽出済みCSVから候補ページとAI回答下書きCSVを作る補助スクリプト。
- `737_Study_Finder/data/`
  - Study Finder用の生成CSV置き場。Git管理対象外です。

## Drive / Apps Script

このリポジトリは、GitHub Pagesで公開するPWAと、Google Apps Script / Google Spreadsheetを利用するバックエンドで構成します。

- GAS Web Appと連携します。
- Google Spreadsheetをデータソースとして利用します。
- GitHub PagesでPWAとして公開します。
- ローカル環境用のURL、Spreadsheet ID、Apps Script IDは非公開ファイルで管理します。
- 公開PWAから呼ぶGAS APIは、読み取り用途の公開APIに限定します。

ローカルの作業ルート:

- 趣味HUB: `gas/`
- 737 Study Finder: `737_Study_Finder/gas/`
- 居酒屋Scout: `IzakayaScout/gas/`
- LifeBoard: `LifeBoard/gas/`

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
