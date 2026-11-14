# maroVid

Vercel 上で動く動画投稿サービスです。Next.js App Router と Vercel Blob で、動画ファイルと投稿情報を保存します。ブラウザからのアップロードには OIDC 対応の presigned URL を使います。

## Vercel への設定

1. GitHub の `exfat-dev3/maroVid` を Vercel にインポートします。
2. Vercel のプロジェクト Storage から Blob ストアを作成して接続します。Public ストアを推奨します。Private ストアでも再生できますが、動画配信は Vercel Function を経由します。Vercel が OIDC を設定します。
3. Discord Developer Portal でアプリを作成し、OAuth2 Redirect URI に `https://<公開ドメイン>/api/auth/discord/callback` を登録します。スコープは `identify` を使います。
4. Vercel の Project Settings → Environment Variables に以下を登録します。
   - `DISCORD_CLIENT_ID`: Discordアプリの Client ID
   - `DISCORD_CLIENT_SECRET`: Discordアプリの Client Secret
   - `DISCORD_REDIRECT_URI`: 登録したコールバックURLと完全一致するURL
   - `SESSION_SECRET`: 32文字以上のランダムな秘密値（例: `openssl rand -hex 32`）
   - `ADMIN_PASSWORD`: 管理ページ用パスワード
5. 再デプロイします。

動画ごとのIDは8文字です。視聴ページは `/watch/id={動画ID}` で開きます。動画の投稿とGoodにはDiscord OAuth2ログインが必要です。投稿者名はDiscordの表示名を使います。再生回数の閲覧・記録はログイン不要です。`/` から MP4 / WebM / MOV の動画ファイル（最大 250 MB）を投稿できます。サムネイルは動画のランダムな位置から自動生成し、動画・サムネイル・投稿情報を Vercel Blob に保存します。`/admin` は `ADMIN_PASSWORD` でログインし、投稿の検索と削除を行えます。

## ローカル開発

```bash
npm install
npm run dev
```

ローカルでは、Vercel の環境変数を取得してください（`vercel env pull .env.local`）。接続が OIDC のみの場合、ローカル開発用に Blob の read-write token も設定してください。
