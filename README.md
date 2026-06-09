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

## Apps Script / clasp

- Script URL: https://script.google.com/d/1zeYJdhMTa4odr3SXLFv6ns0LOg2zmAJeOPxYUjbnACDN8o5oeYtRmzaI/edit
- Web App URL: https://script.google.com/macros/s/AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1/exec
- HobbyHub_Master: https://docs.google.com/spreadsheets/d/1jMJdrYongZ9_mF_2i82g65Hh-0nTHztVusYpg8vEx_A/edit
- Study737_DB: https://docs.google.com/spreadsheets/d/11YODNUHgln3dL_wADeR7va4EfAltIzY68lQxNGvBpto/edit
- Local root: `gas/`

初回だけ、Apps Script画面で `setupProject` を手動実行してDrive/Sheets権限を承認してください。
承認後は、`HobbyHub_Master` と `Study737_DB` がそれぞれDriveの対象フォルダ内に作成されます。

## Webアプリ方針

- 外部AI APIは使わない
- 回答案は `answer_notes` に保存
- 正解扱いはユーザー採用済みの `confirmed_answers` のみ
- ChatGPT/Codex用のプロンプトを生成して手動で使う
- PDF解析はローカルPythonでCSV化してSheetsへ取り込む
