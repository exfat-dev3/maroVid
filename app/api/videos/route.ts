import { del, get, issueSignedToken, list, presignUrl } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VideoRecord = { id: string; title: string; creator: string; views: string; duration: string; thumb: string; src: string; created: number };
const prefix = 'marovid/videos/';

export async function GET() {
  try {
    const { blobs } = await list({ prefix });
    const records = await Promise.all(blobs.filter(blob => blob.pathname.endsWith('.json')).map(async blob => {
      let record: VideoRecord;
      if (blob.url.includes('.private.blob.vercel-storage.com')) {
        const result = await get(blob.pathname, { access: 'private' });
        if (!result?.stream) return null;
        record = await new Response(result.stream).json() as VideoRecord;
      } else {
        const response = await fetch(blob.url, { cache: 'no-store' });
        if (!response.ok) return null;
        record = await response.json() as VideoRecord;
      }
      if (record.src.includes('.private.blob.vercel-storage.com')) record.src = `/api/videos/${record.id}/stream`;
      if (record.thumb.includes('.private.blob.vercel-storage.com')) record.thumb = `/api/videos/${record.id}/thumbnail`;
      return record;
    }));
    return NextResponse.json(records.filter(Boolean).sort((a, b) => b!.created - a!.created));
  } catch (error) {
    console.error('Unable to list videos', error);
    return NextResponse.json({ error: '動画一覧を取得できません。Vercel Blob を接続してください。' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const record = await request.json() as VideoRecord;
    if (!record.id || !/^[\w-]{1,128}$/.test(record.id) || !record.title || !record.src) {
      return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 });
    }
    const source = new URL(record.src);
    if (source.protocol !== 'https:') {
      return NextResponse.json({ error: 'HTTPS の動画 URL を指定してください。' }, { status: 400 });
    }

    const pathname = `${prefix}${record.id}.json`;
    const allowedContentTypes = ['application/json'];
    const maximumSizeInBytes = 1024 * 1024;
    const token = await issueSignedToken({
      pathname,
      operations: ['put'],
      allowedContentTypes,
      maximumSizeInBytes,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: 'put',
      pathname,
      access: 'public',
      allowedContentTypes,
      maximumSizeInBytes,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    const saved = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!saved.ok) {
      const detail = await saved.text();
      console.error('Unable to upload video metadata', saved.status, detail);
      return NextResponse.json({ error: '投稿情報を Vercel Blob に保存できませんでした。', detail }, { status: 503 });
    }
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Unable to create video metadata upload', error);
    return NextResponse.json({ error: '投稿情報を保存できませんでした。', detail }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.json({ error: '管理者パスワードが設定されていません。' }, { status: 503 });
  if (request.headers.get('x-admin-password') !== password) return NextResponse.json({ error: '管理者パスワードが正しくありません。' }, { status: 401 });
  try {
    const { id } = await request.json() as { id?: string };
    if (!id || !/^[\w-]+$/.test(id)) return NextResponse.json({ error: '動画 ID が不正です。' }, { status: 400 });
    const pathname = `${prefix}${id}.json`;
    const { blobs } = await list({ prefix: pathname });
    const metadata = blobs.find(blob => blob.pathname === pathname);
    if (metadata) {
      let record: VideoRecord;
      if (metadata.url.includes('.private.blob.vercel-storage.com')) {
        const result = await get(pathname, { access: 'private' });
        if (!result?.stream) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
        record = await new Response(result.stream).json() as VideoRecord;
      } else {
        record = await fetch(metadata.url, { cache: 'no-store' }).then(r => r.json()) as VideoRecord;
      }
      const videoUrl = record.src;
      const parsedVideoUrl = new URL(videoUrl);
      const videoPath = decodeURIComponent(parsedVideoUrl.pathname);
      const ownedVideo = (parsedVideoUrl.hostname.endsWith('.public.blob.vercel-storage.com') || parsedVideoUrl.hostname.endsWith('.private.blob.vercel-storage.com')) && videoPath.startsWith('/marovid/') && !videoPath.startsWith('/marovid/videos/');
      const thumbnailUrl = record.thumb;
      const parsedThumbnailUrl = new URL(thumbnailUrl);
      const thumbnailPath = decodeURIComponent(parsedThumbnailUrl.pathname);
      const ownedThumbnail = (parsedThumbnailUrl.hostname.endsWith('.public.blob.vercel-storage.com') || parsedThumbnailUrl.hostname.endsWith('.private.blob.vercel-storage.com')) && thumbnailPath.startsWith('/marovid/thumbnails/');
      await del([metadata.url, ...(ownedVideo ? [videoUrl] : []), ...(ownedThumbnail ? [thumbnailUrl] : [])]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to delete video', error);
    return NextResponse.json({ error: '動画を削除できませんでした。' }, { status: 503 });
  }
}
