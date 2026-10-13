# 公開タイムアタック・ランキング配備手順

この機能は**名前入力・会員登録不要**です。上位3件は「順位・正解数・時間」だけを表示し、サーバーで保存します。

## 構成
- GitHub Pages: `time-attack.html`、`ranking.html`
- Cloudflare Worker: `worker/src/index.js`
- Cloudflare D1: `worker/schema.sql`
- 問題マスター: `node scripts/export-question-bank.cjs` で既存470問を `worker/questions.json` に書き出し（**このJSONは配備用に生成**）
- クライアントのAPI設定: `ranking-config.js`

## 配備準備
1. Cloudflareにログインし、Workers / D1 を利用できる状態にする
2. リポジトリを取得し、`node scripts/export-question-bank.cjs` を実行する
3. `cd worker` のうえ `npx wrangler login` と `npx wrangler d1 create salon-quiz-ranking` を実行する
4. 表示されたD1データベースIDを `worker/wrangler.toml` の `database_id` に設定
5. `npx wrangler d1 execute salon-quiz-ranking --remote --file=./schema.sql` でテーブル作成
6. `npx wrangler deploy` でWorkerを公開
7. 返された `https://....workers.dev` を `ranking-config.js` の `window.SALON_RANKING_API` に設定し、GitHub Pagesを更新する
8. 別端末またはシークレットウィンドウから10/20/30問の実測とランキング更新を確認する

## 注意事項
- URLが未設定の間、タイムアタックは接続準備中と表示され、**記録はサーバーに保存されません**。
- 問題と正解はサーバー側で保持し、回答をサーバーで採点。時間はサーバーが開始から回答受信までを計測します（通信遅延を含みます）。
- 記録は匿名で、同じ人かどうかは判断しません。ログインも端末IDも使いません。
- 公開APIは自動化した不正アクセスを完全には防げません。公開運用前にCloudflareのレート制限・WAF設定・利用量アラートを検討してください。
- 問題データの品質確認、負荷試験、複数端末の実地テストは別途必要です。
- タイムアタックに旧ブラウザー履歴は影響しません。
