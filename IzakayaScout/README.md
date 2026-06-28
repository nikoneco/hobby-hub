# 居酒屋Scout

Hot Pepper Gourmet Web Service APIを使って、駅名・地名と気分から居酒屋候補を3件に絞るWebアプリです。

## 方針

- APIキーはコードに保存しません。
- Apps ScriptのScript Propertiesに `HOTPEPPER_API_KEY` を設定します。
- 検索条件はHot Pepper APIで構造化できる項目を優先し、足りない条件はキーワードに混ぜます。
- APIとの相性が低いキーワード条件は画面に出さず、結果にはカード可否と対応カードを表示します。
- 店タイプはHot Pepper公式ジャンルコードを使い、`keyword` ではなく `genre` で絞り込みます。
- 徒歩目安はAPI取得後にアクセス文から読み取り、アプリ内で後処理フィルタします。
- たばこ条件は `non_smoking` レスポンスを表示し、喫煙可などは文字列から後処理フィルタします。
- 営業中条件はHot Pepper APIの `is_open_time=now` で絞り込みます。
- 駅名検索では入力駅名に近い候補を優先し、似た別駅名の候補は順位を下げます。
- 検索結果はスコアリングして、`本命` / `対抗` / `穴場` の3候補に絞ります。
- 表示外の控え候補も保持し、候補カードを外したときに次の店を補充します。
- 直前に外した候補は、下部のトーストから元に戻せます。
- 候補カードから `キープ` と `ここにする` を選べて、迷った店と決定した店を画面内に残せます。

## Drive / Apps Script

- Drive folder: https://drive.google.com/drive/folders/1o5UTjEEwogCUxdVL7vEL0bqdBaeAHFwz
- Script URL: https://script.google.com/d/1Q_h7s1zPIiyC7vSq5o9_a_5H1giDsmLzGQTYYrD8QR4R7BkOaPWMw9NP/edit
- Web App URL: https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec
- Local root: `IzakayaScout/gas/`
