# maroVid

Vercel 上で動く動画投稿サービスです。Next.js App Router と Vercel Blob で、動画ファイルと投稿情報を保存します。

## Vercel への設定

1. GitHub の `exfat-dev3/maroVid` を Vercel にインポートします。
2. Vercel の Storage から Blob ストアを作り、プロジェクトに接続します。接続時に `BLOB_READ_WRITE_TOKEN` が自動で設定されます。
3. Project Settings → Environment Variables で `ADMIN_PASSWORD` を設定します。
4. 再デプロイします。

`/` から動画ファイルを投稿できます。対応形式は MP4 / WebM / MOV、最大 250 MB です。動画は Vercel Blob に直接アップロードされ、一覧情報も同ストアに保存されます。`/admin` は `ADMIN_PASSWORD` でログインし、投稿の検索と削除を行えます。

## ローカル開発

```bash
npm install
npm run dev
```

Blob ストアの接続後に Vercel の環境変数を取得してください（`vercel env pull .env.local`）。
