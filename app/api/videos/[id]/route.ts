import { get, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

type VideoRecord = { id: string; title: string; creator: string; creatorAvatar?: string | null; views?: number | string; likes?: number | string; duration: string; thumb: string; src: string; created: number };
const prefix = 'marovid/videos/';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
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
    return NextResponse.json({ ...record, views: Number(record.views) || 0, likes: Number(record.likes) || 0,
      src: record.src.includes('.private.blob.vercel-storage.com') ? `/api/videos/${id}/stream` : record.src,
      thumb: record.thumb.includes('.private.blob.vercel-storage.com') ? `/api/videos/${id}/thumbnail` : record.thumb,
    });
  } catch (error) {
    console.error('Unable to get video', error);
    return NextResponse.json({ error: '動画情報を取得できませんでした。' }, { status: 503 });
  }
}
