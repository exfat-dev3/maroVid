import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';

type VideoRecord = { id: string; thumb: string };
const metadataPrefix = 'marovid/videos/';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) return new NextResponse('Not found', { status: 404 });
    const metadata = await get(`${metadataPrefix}${id}.json`, { access: 'private' });
    if (!metadata || metadata.statusCode !== 200 || !metadata.stream) return new NextResponse('Not found', { status: 404 });
    const record = await new Response(metadata.stream).json() as VideoRecord;
    if (record.id !== id || !record.thumb) return new NextResponse('Not found', { status: 404 });
    const source = new URL(record.thumb);
    const pathname = decodeURIComponent(source.pathname).replace(/^\//, '');
    if (!source.hostname.endsWith('.private.blob.vercel-storage.com') || !pathname.startsWith('marovid/thumbnails/')) {
      return new NextResponse('Not found', { status: 404 });
    }
    const image = await get(pathname, { access: 'private' });
    if (!image || !image.stream) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(image.stream, {
      headers: {
        'Content-Type': image.blob.contentType || 'image/jpeg',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Unable to stream private thumbnail', error);
    return new NextResponse('Thumbnail unavailable', { status: 503 });
  }
}
