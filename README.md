# 趣味HUB

Google Apps Script Web App + Google Sheetsで作る趣味アプリ群の入口です。

## ランチャー画面

- PCはアプリ一覧と夜の司書さんを並べた2カラム、スマートフォンは上部の画像と2列のアプリ一覧を表示します。
- 「すべて／趣味／日常／航空／ゲーム」で一覧を絞り込み、カードを1回押すと従来と同じアプリを開きます。
- 最近使ったアプリを端末の `localStorage` に最大3件保存します。保存できない環境でも通常の一覧と起動は利用できます。
- 吹き出しは端末の時刻に合わせ、ページ読込時と司書さんのタップ時に朝・昼・夜・深夜それぞれ20種類（計80種類）から選びます。画像・吹き出しのどちらでも押せて、キーボードのEnter／Spaceにも対応します。直近5回のセリフIDを端末へ保存し、次の抽選から除外します。保存できなくても表示できます。
- アプリ一覧の更新ボタンは撤去しました。Pagesでは従来どおり管理用の初期設定を非表示にし、GAS版では初期設定を利用できます。

画面の正本は `gas/index.html`、`gas/style.html`、`gas/script.html` です。`docs` は `node tools/build-pages.js` で生成します。アプリ追加時はモジュールの `category`（`hobby`、`daily`、`aviation`、`game`）を指定でき、既存のGASデータはフロント側の対応表で分類します。

セリフの編集先は `gas/flavor_messages.html` です。`id` は履歴用なので既存行の編集・並べ替え時も維持し、新しい行には未使用IDを付けます。Pagesでは `assets/js/flavor-messages.js` に分離して配信し、Service Workerにも含めます。セリフ履歴は `hobbyHub.flavorHistory.v1` にIDだけを最大5件保存します。

## 構成

- `gas/`
  - 趣味HUB本体。
  - 各アプリへのリンク集/ランチャー専用。
  - `HobbyHub_Master` の `hub_modules` を読んでアプリ一覧を表示します。
- 737 Study Finderは[独立リポジトリ](https://github.com/nikoneco/Study_Finder)へ移行しました。
  - [独立PWA](https://nikoneco.github.io/Study_Finder/)を`docs/737-study-finder/`の中継ページからiframe表示します。
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

- 趣味HUB: `gas/`
- 737 Study Finder: `D:\アプリ開発\737-800勉強`（独立Git）
- 居酒屋Scout: `IzakayaScout/gas/`
- LifeBoard: `LifeBoard/gas/`

## Study Finderの運用

PDF抽出・CSV生成・データ検証・GAS操作は独立したStudy Finderプロジェクトで行います。現行仕様とコマンドは[独立リポジトリのREADME](https://github.com/nikoneco/Study_Finder)を参照してください。従来のコード履歴はこのリポジトリに保持しています。

趣味HUBは既存の入口URLとGAS直表示版向け回答画像の互換配信だけを担当し、Study Finder本体は生成しません。

## 趣味HUBの外部PWAリンク方針

- 別プロジェクトのPWAを趣味HUBに追加するときは、外部URLへ直接遷移させず、`/hobby-hub/<app-slug>/` 配下の中継ページを作ります。
- 中継ページは外部PWAを `iframe` で表示し、画面内の戻るボタンは置きません。
- `tools/build-pages.js` の `pageTargets` と Service Worker のキャッシュ対象へ中継ページを追加します。
