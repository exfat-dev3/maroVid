import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';

export const runtime = 'nodejs';

const allowedContentTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
const maximumSizeInBytes = 250 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as HandleUploadPresignedBody;
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async pathname => {
        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          allowedContentTypes,
          maximumSizeInBytes,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes,
            maximumSizeInBytes,
            addRandomSuffix: true,
          },
        };
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Vercel Blob presigned upload error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
