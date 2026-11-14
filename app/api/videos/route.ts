import { del, list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VideoRecord = { id: string; title: string; creator: string; views: string; duration: string; thumb: string; src: string; created: number };
const prefix = 'marovid/videos/';

export async function GET() {
  try {
    const { blobs } = await list({ prefix });
    const records = await Promise.all(blobs.filter(blob => blob.pathname.endsWith('.json')).map(async blob => {
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) return null;
      return response.json() as Promise<VideoRecord>;
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
    if (!record.id || !record.title || !record.src) return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 });
    let source: URL;
    try { source = new URL(record.src); } catch { return NextResponse.json({ error: '動画 URL が正しくありません。' }, { status: 400 }); }
    if (source.protocol !== 'https:') return NextResponse.json({ error: 'HTTPS の動画 URL を指定してください。' }, { status: 400 });
    await put(`${prefix}${record.id}.json`, JSON.stringify(record), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Unable to save video metadata', error);
    return NextResponse.json({ error: '投稿を保存できませんでした。' }, { status: 503 });
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
      const record = await fetch(metadata.url, { cache: 'no-store' }).then(r => r.json()) as VideoRecord;
      const videoUrl = record.src;
      const parsedVideoUrl = new URL(videoUrl);
      const videoPath = decodeURIComponent(parsedVideoUrl.pathname);
      const ownedVideo = parsedVideoUrl.hostname.endsWith('.public.blob.vercel-storage.com') && videoPath.startsWith('/marovid/');
      await del([metadata.url, ...(ownedVideo ? [videoUrl] : [])]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to delete video', error);
    return NextResponse.json({ error: '動画を削除できませんでした。' }, { status: 503 });
  }
}
