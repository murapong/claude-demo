# claude-demo

お問い合わせ管理アプリのデモプロジェクト。

## 技術スタック

- Node.js の標準モジュールのみで作る(`node:http` / `node:fs` など)
- npmパッケージ・フレームワーク・ビルドツールは一切使わない(package.jsonも作らない)
- ファイル構成:
  - `server.js` — HTTPサーバー。静的ファイル配信とJSON APIを兼ねる
  - `public/index.html` / `public/style.css` / `public/app.js` — 画面
  - `data/db.json` — データ保存先(gitignore対象)
- `data/db.json` は初回起動時に自動作成し、サンプルデータを数件シードする

## 規約

- UIの文言は日本語
- 受付番号は `INQ-1` 形式(idから導出)
- 問い合わせのステータス: 未対応 / 対応中 / 完了 / 却下
- APIは入力バリデーションをして、不正時はHTTP 422を返す

## 開発

- 起動: `node server.js`
- URL: http://localhost:3000
- データリセット: `rm -f data/db.json`(次回起動時に自動再作成)
