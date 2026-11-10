# セキュリティ

## 脆弱性の報告

このツール集の脆弱性（ページで意図しないスクリプトが動く、など）を見つけたら、**公開の Issue や LINE オープンチャットには書かず**、
GitHub の [Security タブ](https://github.com/yuyumiayu/yuke-yusya-tools/security) の「Report a vulnerability」から非公開で知らせてください。
確かめて直したあとで、必要なら内容を公開します。

データの間違いや、計算・画面の不具合は、これまでどおり [Issue](https://github.com/yuyumiayu/yuke-yusya-tools/issues/new/choose) か LINE オープンチャットへどうぞ。

## このツール集のつくり

- 公開しているのは、GitHub Pages に置いた静的な HTML だけです。ログイン・サーバー・外部への送信はありません。
- 入力や設定は、使っている人のブラウザ（localStorage）にだけ保存します。
- 各ページには CSP（Content-Security-Policy）を入れていて、ページに入っているスクリプト以外は動きません。
