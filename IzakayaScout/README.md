# 居酒屋Scout

現在地または駅名から、Google Maps の居酒屋検索URLを作る無課金MVPです。

## 方針

- Google Places API は使いません。
- Google Cloud の課金設定は不要です。
- 店一覧、営業時間、評価、予約可否は Google Maps 側で確認します。
- 位置情報はブラウザ内で検索語生成に使うだけで、GASやSheetへ保存しません。

## Local root

- `IzakayaScout/gas/`

## Drive / Apps Script

- Drive folder: https://drive.google.com/drive/folders/1RD2Hbp3n4C1f9HgDTPbRyuHCEmqscjvY
- Script URL: https://script.google.com/d/1jOmEUFlVEWq57qdYTWNDXdL5znnQXTaKPyytIbPqAsE_wZ74Uk-NBXuC/edit
- Web App URL: https://script.google.com/macros/s/AKfycbz6JdN9R-WSetCdw4XDlPOTgwWPS8WpqfdlPXKsNEFosEK5pK5suDaJU4v7jLj8H0sE/exec
