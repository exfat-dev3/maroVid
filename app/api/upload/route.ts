import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';

export const runtime = 'nodejs';

const videoContentTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
const videoMaximumSizeInBytes = 250 * 1024 * 1024;
const metadataContentTypes = ['application/json'];
const metadataMaximumSizeInBytes = 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as HandleUploadPresignedBody;
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async pathname => {
        const isMetadata = /^marovid\/videos\/[\w-]+\.json$/i.test(pathname);
        const isVideo = pathname.startsWith('marovid/') && !pathname.startsWith('marovid/videos/');
        if (!isMetadata && !isVideo) throw new Error('Invalid upload path');
        const allowedContentTypes = isMetadata ? metadataContentTypes : videoContentTypes;
        const maximumSizeInBytes = isMetadata ? metadataMaximumSizeInBytes : videoMaximumSizeInBytes;
        const token = await issueSignedToken({ pathname, operations: ['put'], allowedContentTypes, maximumSizeInBytes });
        return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes, addRandomSuffix: !isMetadata } };
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Vercel Blob presigned upload error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
