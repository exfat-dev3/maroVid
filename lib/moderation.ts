import { get, issueSignedToken, list, presignUrl } from '@vercel/blob';
import { decryptPrivateValue, encryptPrivateValue } from './auth';

export type UserRestriction = { banned: boolean; timeoutUntil: number | null; reason: string | null; updatedAt?: number };
type ModerationMap = Record<string, UserRestriction>;
const pathname = 'marovid/admin/moderation.json';

async function readMap(): Promise<{ map: ModerationMap; metadataUrl: string | null }> {
  const { blobs } = await list({ prefix: pathname });
  const metadata = blobs.find(blob => blob.pathname === pathname);
  if (!metadata) return { map: {}, metadataUrl: null };
  let stored: { encrypted?: string };
  if (metadata.url.includes('.private.blob.vercel-storage.com')) {
    const result = await get(pathname, { access: 'private' });
    if (!result?.stream) return { map: {}, metadataUrl: metadata.url };
    stored = await new Response(result.stream).json() as { encrypted?: string };
  } else {
    const response = await fetch(metadata.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to read moderation data');
    stored = await response.json() as { encrypted?: string };
  }
  if (!stored.encrypted) return { map: {}, metadataUrl: metadata.url };
  const decoded = decryptPrivateValue(stored.encrypted);
  if (!decoded) throw new Error('Unable to decrypt moderation data');
  return { map: JSON.parse(decoded) as ModerationMap, metadataUrl: metadata.url };
}

export async function getUserRestriction(userId: string): Promise<UserRestriction | null> {
  const { map } = await readMap();
  const restriction = map[userId];
  if (!restriction) return null;
  if (!restriction.banned && (!restriction.timeoutUntil || restriction.timeoutUntil <= Date.now())) return null;
  return restriction;
}

export async function getAllRestrictions(): Promise<ModerationMap> {
  return (await readMap()).map;
}

export async function saveUserRestriction(userId: string, restriction: UserRestriction | null) {
  const { map, metadataUrl } = await readMap();
  if (restriction) map[userId] = restriction; else delete map[userId];
  let access: 'public' | 'private' = metadataUrl?.includes('.private.blob.vercel-storage.com') ? 'private' : 'public';
  if (!metadataUrl) {
    const { blobs } = await list({ prefix: 'marovid/videos/' });
    if (blobs.some(blob => blob.url.includes('.private.blob.vercel-storage.com'))) access = 'private';
  }
  const allowedContentTypes = ['application/json'];
  const maximumSizeInBytes = 1024 * 1024;
  const token = await issueSignedToken({ pathname, operations: ['put'], allowedContentTypes, maximumSizeInBytes });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put', pathname, access, allowedContentTypes, maximumSizeInBytes,
    addRandomSuffix: false, allowOverwrite: Boolean(metadataUrl),
  });
  const response = await fetch(presignedUrl, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ encrypted: encryptPrivateValue(JSON.stringify(map)) }),
  });
  if (!response.ok) throw new Error('Unable to save moderation data');
}
