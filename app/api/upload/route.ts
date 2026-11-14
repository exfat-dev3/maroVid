import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
        maximumSizeInBytes: 250 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ source: 'marovid' }),
      }),
    });
    return Response.json(jsonResponse);
  } catch (error) {
    console.error('Video upload token error', error);
    return Response.json({ error: '動画アップロードを開始できません。Vercel Blob を接続してください。' }, { status: 400 });
  }
}
