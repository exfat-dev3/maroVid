import { issueSignedToken } from '@vercel/blob';
import { getSession } from '@/lib/auth';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';

export const runtime = 'nodejs';

const videoContentTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
const videoMaximumSizeInBytes = 250 * 1024 * 1024;
const thumbnailContentTypes = ['image/jpeg'];

export async function POST(request: Request): Promise<Response> {
  if (!getSession(request)) return Response.json({ error: '動画投稿にはDiscordログインが必要です。' }, { status: 401 });
  try {
    const body = await request.json() as HandleUploadPresignedBody;
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async pathname => {
        const isThumbnail = /^marovid\/thumbnails\/[\w-]+\.jpg$/i.test(pathname);
        const isVideo = /^marovid\/[\\w.\\-ぁ-んァ-ン一-龯]+$/.test(pathname);
        if (!isThumbnail && !isVideo) throw new Error('Invalid upload path');
        const allowedContentTypes = isThumbnail ? thumbnailContentTypes : videoContentTypes;
        const maximumSizeInBytes = isVideo ? videoMaximumSizeInBytes : 1024 * 1024;
        const token = await issueSignedToken({ pathname, operations: ['put'], allowedContentTypes, maximumSizeInBytes });
        return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes, addRandomSuffix: isVideo } };
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Vercel Blob presigned upload error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
