# AGENTS.md

このプロジェクトはGitHub運用対象。

作業開始時はグローバル入口ルールと開発運用ルールを確認する。

- `C:\Users\aqua_\.codex\AGENTS.md`
- `C:\Users\aqua_\.codex\Program_Development.md`

特に `Program_Development.md` の「GitHub連携とGAS作業フロー」に従う。

## 趣味HUBの外部PWAリンク方針

- 趣味HUBに別プロジェクトのPWAを追加するときは、外部URLへ直接遷移させず、`/hobby-hub/<app-slug>/` 配下の中継ページを作る。
- 中継ページは外部PWAを `iframe` で表示する。画面内の戻るボタンは置かず、端末やブラウザの戻る操作に任せる。
- `tools/build-pages.js` の `pageTargets` と Service Worker のキャッシュ対象にも中継ページを追加する。
