# 居酒屋ScoutHP

Hot Pepper Gourmet Web Service APIを使って、駅名・地名から飲食店候補をWebアプリ内に表示する試作版です。

## 方針

- APIキーはコードに保存しません。
- Apps ScriptのScript Propertiesに `HOTPEPPER_API_KEY` を設定します。
- 検索条件はHot Pepper APIで構造化できる項目を優先し、足りない条件はキーワードに混ぜます。

## Drive / Apps Script

- Drive folder: https://drive.google.com/drive/folders/1o5UTjEEwogCUxdVL7vEL0bqdBaeAHFwz
- Script URL: https://script.google.com/d/1Q_h7s1zPIiyC7vSq5o9_a_5H1giDsmLzGQTYYrD8QR4R7BkOaPWMw9NP/edit
- Web App URL: https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec
- Local root: `IzakayaScoutHP/gas/`
