# 趣味HUB

Google Apps Script Web App + Google Sheetsで作る趣味/学習HUBです。

## 現在の検証対象

- ローカル資料: `../737_Study_Finder`
- Study Guide: `Study_Guide/24_REF.pdf`
- 標準問題集: `標準問題集/737-800標準問題集(2012.03.13).pdf`
- Driveフォルダ:
  - `マイドライブ/アプリ開発/趣味HUB`
  - `マイドライブ/アプリ開発/737_Study_Finder`

## 初期化方針

`gas/SetupService.gs` の `setupProject()` を実行すると、以下を作成または再利用します。

- `HobbyHub_Master`: 趣味HUBフォルダ内
- `Study737_DB`: 737_Study_Finderフォルダ内

作成後、必要なシートとヘッダーを用意し、ATA 24の動作確認用サンプルを投入します。

## Webアプリ方針

- 外部AI APIは使わない
- 回答案は `answer_notes` に保存
- 正解扱いはユーザー採用済みの `confirmed_answers` のみ
- ChatGPT/Codex用のプロンプトを生成して手動で使う
- PDF解析はローカルPythonでCSV化してSheetsへ取り込む
