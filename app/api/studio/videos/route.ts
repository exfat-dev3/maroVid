import { get, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';

type VideoRecord = { id: string; ownerId?: string; title: string; creator: string; views?: number | string; likes?: number; duration: string; thumb: string; src: string; created: number };
const prefix = 'marovid/videos/';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = getSession(request);
  if (!user) return NextResponse.json({ error: 'maroStudioにはDiscordログインが必要です。' }, { status: 401 });
  try {
    const { blobs } = await list({ prefix });
    const owned = await Promise.all(blobs.filter(blob => blob.pathname.endsWith('.json')).map(async blob => {
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
      if (record.ownerId !== user.id) return null;
      return {
        id: record.id, title: record.title, creator: record.creator, views: Number(record.views) || 0,
        likes: Number(record.likes) || 0, duration: record.duration,
        thumb: record.thumb.includes('.private.blob.vercel-storage.com') ? `/api/videos/${record.id}/thumbnail` : record.thumb,
        src: record.src.includes('.private.blob.vercel-storage.com') ? `/api/videos/${record.id}/stream` : record.src,
        created: record.created,
      };
    }));
    return NextResponse.json(owned.filter(Boolean).sort((a, b) => b!.created - a!.created));
  } catch (error) {
    console.error('Unable to list Studio videos', error);
    return NextResponse.json({ error: '自分の動画を取得できませんでした。' }, { status: 503 });
  }
}
