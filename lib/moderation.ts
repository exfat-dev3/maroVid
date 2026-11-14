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

export type RegisteredAccount = { id: string; username: string; avatar: string | null; email: string | null; updatedAt: number };
type StoredAccount = { username: string; avatar: string | null; emailEncrypted: string | null; updatedAt: number };
const accountsPath = 'marovid/admin/accounts.json';

async function readAccounts(): Promise<{ accounts: Record<string, StoredAccount>; metadataUrl: string | null }> {
  const { blobs } = await list({ prefix: accountsPath });
  const metadata = blobs.find(blob => blob.pathname === accountsPath);
  if (!metadata) return { accounts: {}, metadataUrl: null };
  let stored: { encrypted?: string };
  if (metadata.url.includes('.private.blob.vercel-storage.com')) {
    const result = await get(accountsPath, { access: 'private' });
    if (!result?.stream) return { accounts: {}, metadataUrl: metadata.url };
    stored = await new Response(result.stream).json() as { encrypted?: string };
  } else {
    const response = await fetch(metadata.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to read registered accounts');
    stored = await response.json() as { encrypted?: string };
  }
  if (!stored.encrypted) return { accounts: {}, metadataUrl: metadata.url };
  const decoded = decryptPrivateValue(stored.encrypted);
  if (!decoded) throw new Error('Unable to decrypt registered accounts');
  return { accounts: JSON.parse(decoded) as Record<string, StoredAccount>, metadataUrl: metadata.url };
}

async function writeEncryptedBlob(path: string, value: unknown, existingUrl: string | null) {
  let access: 'public' | 'private' = existingUrl?.includes('.private.blob.vercel-storage.com') ? 'private' : 'public';
  if (!existingUrl) {
    const { blobs } = await list({ prefix: 'marovid/' });
    if (blobs.some(blob => blob.url.includes('.private.blob.vercel-storage.com'))) access = 'private';
  }
  const allowedContentTypes = ['application/json'];
  const maximumSizeInBytes = 1024 * 1024;
  const token = await issueSignedToken({ pathname: path, operations: ['put'], allowedContentTypes, maximumSizeInBytes });
  const { presignedUrl } = await presignUrl(token, { operation: 'put', pathname: path, access, allowedContentTypes, maximumSizeInBytes, addRandomSuffix: false, allowOverwrite: Boolean(existingUrl) });
  const response = await fetch(presignedUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ encrypted: encryptPrivateValue(JSON.stringify(value)) }) });
  if (!response.ok) throw new Error('Unable to save encrypted account data');
}

export async function upsertRegisteredAccount(user: { id: string; username: string; avatar: string | null; email?: string | null }) {
  const { accounts, metadataUrl } = await readAccounts();
  const existing = accounts[user.id];
  accounts[user.id] = {
    username: user.username,
    avatar: user.avatar,
    emailEncrypted: user.email ? encryptPrivateValue(user.email) : existing?.emailEncrypted || null,
    updatedAt: Date.now(),
  };
  await writeEncryptedBlob(accountsPath, accounts, metadataUrl);
}

export async function getRegisteredAccounts(): Promise<RegisteredAccount[]> {
  const { accounts } = await readAccounts();
  return Object.entries(accounts).map(([id, account]) => ({
    id, username: account.username, avatar: account.avatar,
    email: account.emailEncrypted ? decryptPrivateValue(account.emailEncrypted) : null,
    updatedAt: account.updatedAt,
  }));
}
