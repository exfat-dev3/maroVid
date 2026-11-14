# maroVid

Vercel 上で動く動画投稿サービスです。Next.js App Router と Vercel Blob で、動画ファイルと投稿情報を保存します。ブラウザからのアップロードには OIDC 対応の presigned URL を使います。

## Vercel への設定

1. GitHub の `exfat-dev3/maroVid` を Vercel にインポートします。
2. Vercel のプロジェクト Storage から **Public** Blob ストアを作成し、このプロジェクトに接続します。Vercel が OIDC を設定します。
3. Project Settings → Environment Variables で `ADMIN_PASSWORD` を設定します。
4. 再デプロイします。

`/` から MP4 / WebM / MOV の動画ファイル（最大 250 MB）を投稿できます。動画と投稿情報は Vercel Blob に保存されます。`/admin` は `ADMIN_PASSWORD` でログインし、投稿の検索と削除を行えます。

## ローカル開発

```bash
npm install
npm run dev
```

ローカルでは、Vercel の環境変数を取得してください（`vercel env pull .env.local`）。接続が OIDC のみの場合、ローカル開発用に Blob の read-write token も設定してください。
