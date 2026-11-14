import { del, get, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth';

type VideoRecord = { id: string; ownerId?: string; src: string; thumb: string };
const prefix = 'marovid/videos/';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isOwnedBlob(url: string, expectedPrefix: string) {
  try {
    const parsed = new URL(url);
    const isBlobHost = parsed.hostname.endsWith('.public.blob.vercel-storage.com') || parsed.hostname.endsWith('.private.blob.vercel-storage.com');
    const path = decodeURIComponent(parsed.pathname);
    return isBlobHost && path.startsWith(expectedPrefix);
  } catch {
    return false;
  }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ error: '動画の削除にはDiscordログインが必要です。' }, { status: 401 });
  try {
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: '動画 ID が不正です。' }, { status: 400 });
    const pathname = `${prefix}${id}.json`;
    const { blobs } = await list({ prefix: pathname });
    const metadata = blobs.find(blob => blob.pathname === pathname);
    if (!metadata) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
    let record: VideoRecord;
    if (metadata.url.includes('.private.blob.vercel-storage.com')) {
      const result = await get(pathname, { access: 'private' });
      if (!result?.stream) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
      record = await new Response(result.stream).json() as VideoRecord;
    } else {
      const response = await fetch(metadata.url, { cache: 'no-store' });
      if (!response.ok) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
      record = await response.json() as VideoRecord;
    }
    if (record.ownerId !== user.id) return NextResponse.json({ error: 'この動画を削除する権限がありません。' }, { status: 403 });
    const urls = [metadata.url];
    if (isOwnedBlob(record.src, '/marovid/') && !isOwnedBlob(record.src, '/marovid/videos/')) urls.push(record.src);
    if (isOwnedBlob(record.thumb, '/marovid/thumbnails/')) urls.push(record.thumb);
    await del(urls);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to delete Studio video', error);
    return NextResponse.json({ error: '動画を削除できませんでした。' }, { status: 503 });
  }
}
