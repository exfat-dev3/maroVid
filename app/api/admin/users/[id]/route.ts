import { NextResponse } from 'next/server';
import { saveUserRestriction } from '../../../../../lib/moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function authorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password && request.headers.get('x-admin-password') === password);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: '管理者パスワードが正しくありません。' }, { status: 401 });
  try {
    const { id } = await context.params;
    if (!/^\d{17,20}$/.test(id)) return NextResponse.json({ error: 'DiscordユーザーIDが不正です。' }, { status: 400 });
    const body = await request.json() as { action?: string; durationMinutes?: number; reason?: string };
    const reason = String(body.reason || '').trim().slice(0, 200) || null;
    const now = Date.now();
    if (body.action === 'unban') {
      await saveUserRestriction(id, null);
      return NextResponse.json({ ok: true, banned: false, timeoutUntil: null });
    }
    if (body.action === 'ban') {
      const restriction = { banned: true, timeoutUntil: null, reason, updatedAt: now };
      await saveUserRestriction(id, restriction);
      return NextResponse.json({ ok: true, ...restriction });
    }
    if (body.action === 'timeout') {
      const durationMinutes = Number(body.durationMinutes);
      if (![10, 60, 1440, 10080].includes(durationMinutes)) return NextResponse.json({ error: 'タイムアウト期間が不正です。' }, { status: 400 });
      const restriction = { banned: false, timeoutUntil: now + durationMinutes * 60_000, reason, updatedAt: now };
      await saveUserRestriction(id, restriction);
      return NextResponse.json({ ok: true, ...restriction });
    }
    return NextResponse.json({ error: '操作が不正です。' }, { status: 400 });
  } catch (error) {
    console.error('Unable to update moderation', error);
    return NextResponse.json({ error: '制限状態を保存できませんでした。' }, { status: 503 });
  }
}
