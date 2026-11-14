import { NextResponse } from 'next/server';
import { clearCookie, getSession } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const user = getSession(request);
  return NextResponse.json({ user: user ? { id: user.id, username: user.username, avatar: user.avatar } : null });
}
export async function DELETE(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.append('Set-Cookie', clearCookie('marovid_session', request));
  return response;
}
