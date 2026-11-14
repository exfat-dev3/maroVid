import { NextResponse } from 'next/server';
import { createOAuthState, createPkceVerifier, oauthStateCookie, pkceCookie, createOAuthPkceChallenge, returnToCookie } from '../../../../lib/auth';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET || !process.env.SESSION_SECRET || (process.env.SESSION_SECRET.length < 32)) {
    return NextResponse.json({ error: 'Discord OAuth の環境変数が設定されていません。' }, { status: 503 });
  }
  const redirectUri = process.env.DISCORD_REDIRECT_URI || new URL('/api/auth/discord/callback', request.url).toString();
  const state = createOAuthState();
  const verifier = createPkceVerifier();
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', 'identify email');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', createOAuthPkceChallenge(verifier));
  authorize.searchParams.set('code_challenge_method', 'S256');
  const response = NextResponse.redirect(authorize);
  response.headers.append('Set-Cookie', oauthStateCookie(state, request));
  response.headers.append('Set-Cookie', pkceCookie(verifier, request));
  const next = new URL(request.url).searchParams.get('next');
  response.headers.append('Set-Cookie', returnToCookie(next === '/studio' ? '/studio' : '/', request));
  return response;
}
