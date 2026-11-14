import { get, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { decryptPrivateValue } from '../../../../lib/auth';
import { getAllRestrictions } from '../../../../lib/moderation';

type VideoRecord = { id: string; ownerId?: string; creator: string; creatorAvatar?: string | null; ownerEmailEncrypted?: string | null };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password && request.headers.get('x-admin-password') === password);
}
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: '管理者パスワードが正しくありません。' }, { status: 401 });
  try {
    const { blobs } = await list({ prefix: 'marovid/videos/' });
    const users = new Map<string, { id: string; username: string; avatar: string | null; email: string | null; videoCount: number; videoIds: string[] }>();
    await Promise.all(blobs.filter(blob => blob.pathname.endsWith('.json')).map(async blob => {
      let record: VideoRecord;
      if (blob.url.includes('.private.blob.vercel-storage.com')) {
        const result = await get(blob.pathname, { access: 'private' });
        if (!result?.stream) return;
        record = await new Response(result.stream).json() as VideoRecord;
      } else {
        const response = await fetch(blob.url, { cache: 'no-store' });
        if (!response.ok) return;
        record = await response.json() as VideoRecord;
      }
      if (!record.ownerId) return;
      const current = users.get(record.ownerId) || { id: record.ownerId, username: record.creator, avatar: record.creatorAvatar || null, email: null, videoCount: 0, videoIds: [] };
      current.username = record.creator || current.username;
      current.avatar = record.creatorAvatar || current.avatar;
      if (record.ownerEmailEncrypted) current.email = decryptPrivateValue(record.ownerEmailEncrypted) || current.email;
      current.videoCount += 1;
      current.videoIds.push(record.id);
      users.set(record.ownerId, current);
    }));
    const restrictions = await getAllRestrictions();
    return NextResponse.json({ users: Array.from(users.values()).map(user => ({
      ...user,
      banned: restrictions[user.id]?.banned === true,
      timeoutUntil: restrictions[user.id]?.timeoutUntil && restrictions[user.id].timeoutUntil! > Date.now() ? restrictions[user.id].timeoutUntil : null,
      reason: restrictions[user.id]?.reason || null,
    })).sort((a, b) => a.username.localeCompare(b.username)) });
  } catch (error) {
    console.error('Unable to load admin users', error);
    return NextResponse.json({ error: '投稿者一覧を取得できませんでした。' }, { status: 503 });
  }
}
