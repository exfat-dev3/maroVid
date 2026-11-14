import { get } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

type VideoRecord = { id: string; src: string };
const metadataPrefix = 'marovid/videos/';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) return new NextResponse('Not found', { status: 404 });

    const metadata = await get(`${metadataPrefix}${id}.json`, { access: 'private' });
    if (!metadata || metadata.statusCode !== 200 || !metadata.stream) return new NextResponse('Not found', { status: 404 });
    const record = await new Response(metadata.stream).json() as VideoRecord;
    if (record.id !== id || !record.src) return new NextResponse('Not found', { status: 404 });

    const source = new URL(record.src);
    const pathname = decodeURIComponent(source.pathname).replace(/^\//, '');
    if (!source.hostname.endsWith('.private.blob.vercel-storage.com') || !pathname.startsWith('marovid/') || pathname.startsWith(metadataPrefix)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const range = request.headers.get('range');
    const video = await get(pathname, { access: 'private', headers: range ? { range } : undefined });
    if (!video || !video.stream) return new NextResponse('Not found', { status: 404 });

    const headers = new Headers({
      'Content-Type': video.blob.contentType || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
      'Accept-Ranges': 'bytes',
    });
    for (const name of ['content-length', 'content-range', 'etag']) {
      const value = video.headers.get(name);
      if (value) headers.set(name, value);
    }
    const partial = headers.has('content-range');
    return new NextResponse(video.stream, { status: partial ? 206 : 200, headers });
  } catch (error) {
    console.error('Unable to stream private video', error);
    return new NextResponse('Video unavailable', { status: 503 });
  }
}
