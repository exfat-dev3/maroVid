import { get, issueSignedToken, list, presignUrl } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

type VideoRecord = { id: string; title: string; creator: string; views?: number | string; likes?: number | string; duration: string; thumb: string; src: string; created: number };
const prefix = 'marovid/videos/';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: '動画が見つかりません。' }, { status: 404 });
    const { action } = await request.json() as { action?: 'view' | 'like' | 'unlike' };
    if (!['view', 'like', 'unlike'].includes(action || '')) return NextResponse.json({ error: '操作が不正です。' }, { status: 400 });
    if (action !== 'view' && !getSession(request)) return NextResponse.json({ error: 'Good にはDiscordログインが必要です。' }, { status: 401 });
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

    record.views = Number(record.views) || 0;
    record.likes = Number(record.likes) || 0;
    if (action === 'view') record.views = Number(record.views) + 1;
    if (action === 'like') record.likes = Number(record.likes) + 1;
    if (action === 'unlike') record.likes = Math.max(0, Number(record.likes) - 1);

    const access = metadata.url.includes('.private.blob.vercel-storage.com') ? 'private' : 'public';
    const allowedContentTypes = ['application/json'];
    const maximumSizeInBytes = 1024 * 1024;
    const token = await issueSignedToken({ pathname, operations: ['put'], allowedContentTypes, maximumSizeInBytes });
    const { presignedUrl } = await presignUrl(token, { operation: 'put', pathname, access, allowedContentTypes, maximumSizeInBytes, allowOverwrite: true, addRandomSuffix: false });
    const saved = await fetch(presignedUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(record) });
    if (!saved.ok) {
      const detail = await saved.text();
      console.error('Unable to update video engagement', saved.status, detail);
      return NextResponse.json({ error: 'Good・再生回数を保存できませんでした。' }, { status: 503 });
    }
    return NextResponse.json({ views: record.views, likes: record.likes });
  } catch (error) {
    console.error('Unable to update video engagement', error);
    return NextResponse.json({ error: 'Good・再生回数を更新できませんでした。' }, { status: 503 });
  }
}
