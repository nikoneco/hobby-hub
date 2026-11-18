# 趣味HUB

自作アプリ群を開く [GitHub Pages PWA](https://nikoneco.github.io/hobby-hub/) です。管理用の入口は Google Apps Script Web App と Google Sheets を使います。

## ランチャー画面

- 書斎の5つの入口から、アプリごとの演出と紹介を表示します。「アプリ一覧」から全9件を開けます。
- LifeBoard と居酒屋ScoutはHUB配下で開きます。家計簿や Arrow Journey などは各アプリの公開先へ移動します。
- アプリ一覧には、端末の `localStorage` に保存した最近使ったアプリを最大3件表示します。
- 司書さんを押すと、端末の時刻に合わせて朝・昼・夜・深夜それぞれ20種類からセリフを選びます。直近5回のセリフは次の抽選から除外します。

Pagesの画面と画像は `pages/hub/`、アプリの登録情報は `tools/build-pages.js` のHUBカタログにあります。`node tools/build-pages.js` で `docs` を再生成します。モジュールのカテゴリは `hobby`、`daily`、`aviation`、`game` です。GAS直表示版の画面は `gas/index.html`、`gas/style.html`、`gas/script.html` にあります。

セリフの編集先は `gas/flavor_messages.html` です。`id` は履歴用なので既存行の編集・並べ替え時も維持し、新しい行には未使用IDを付けます。Pagesでは `assets/js/flavor-messages.js` に分離して配信し、Service Workerにも含めます。セリフ履歴は `hobbyHub.flavorHistory.v1` にIDだけを最大5件保存します。

## 構成

- `gas/`
  - 趣味HUB本体。
  - 各アプリへのリンク集/ランチャー専用。
  - `HobbyHub_Master` の `hub_modules` を読んでアプリ一覧を表示します。
- 737 Study Finderは[独立リポジトリ](https://github.com/nikoneco/Study_Finder)へ移行しました。
  - カードから[独立PWA](https://nikoneco.github.io/Study_Finder/)へ直接移動します。旧`docs/737-study-finder/`も同じPWAへの転送ページとして維持します。
  - ローカル作業ルートは`D:\アプリ開発\737-800勉強`です。GAS・Study737_DBは従来どおりです。
- `IzakayaScout/gas/`
  - 居酒屋Scout本体。
  - Hot Pepper Gourmet Web Service APIで駅名・地名と気分から居酒屋候補を3件に絞ります。
- `assets/study737-legacy-figures/`
  - GAS直表示版が使う旧回答画像URLを維持するための互換画像。新PWAの画像正本は独立リポジトリです。

## Drive / Apps Script

このリポジトリは、GitHub Pagesで公開するPWAと、Google Apps Script / Google Spreadsheetを利用するバックエンドで構成します。

- GAS Web Appと連携します。
- Google Spreadsheetをデータソースとして利用します。
- GitHub PagesでPWAとして公開します。
- ローカル環境用のURL、Spreadsheet ID、Apps Script IDは非公開ファイルで管理します。
- 公開PWAから呼ぶGAS APIは、読み取り用途の公開APIに限定します。

ローカルの作業ルート:

- 趣味HUB: `pages/hub/`（Pages）、`gas/`（GAS直表示）
- 737 Study Finder: `D:\アプリ開発\737-800勉強`（独立Git）
- 居酒屋Scout: `IzakayaScout/gas/`
- LifeBoard: `LifeBoard/gas/`

## Study Finderの運用

PDF抽出・CSV生成・データ検証・GAS操作は独立したStudy Finderプロジェクトで行います。現行仕様とコマンドは[独立リポジトリのREADME](https://github.com/nikoneco/Study_Finder)を参照してください。従来のコード履歴はこのリポジトリに保持しています。

趣味HUBは独立PWAへのリンク、既存の入口URLの転送、GAS直表示版向け回答画像の互換配信を担当し、Study Finder本体は生成しません。

## 趣味HUBの外部PWAリンク方針

- ユーザー指定により、737 Study Finder・趣味部屋図書館・CelestiFrame・数独・家計簿・Arrow Journeyは、それぞれの独立PWAのURLへ直接移動します。
- 旧HUB内の `737-study-finder/`・`room-library/`・`celestiframe/`・`sudoku/` は、iframeを使わず各PWAへ転送します。旧URLとStudy Finderの互換画像は維持します。
- 旧URLの転送ページはService Workerのキャッシュ対象として維持し、更新時に古いiframeページから切り替えます。
