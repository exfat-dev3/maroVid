import { NextResponse } from 'next/server';
import { clearCookie, createOAuthPkceChallenge, getCookie, makeSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'marovid_oauth_state');
  const verifier = getCookie(request, 'marovid_pkce');
  const failure = () => {
    const response = NextResponse.redirect(new URL('/?auth=failed', request.url));
    response.headers.append('Set-Cookie', clearCookie('marovid_oauth_state', request));
    response.headers.append('Set-Cookie', clearCookie('marovid_pkce', request));
    return response;
  };
  if (!code || !state || !savedState || state !== savedState || !verifier) return failure();

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret || sessionSecret.length < 32) return failure();
  const redirectUri = process.env.DISCORD_REDIRECT_URI || new URL('/api/auth/discord/callback', request.url).toString();

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return failure();
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
    if (!token.access_token) return failure();
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${token.token_type || 'Bearer'} ${token.access_token}` },
      cache: 'no-store',
    });
    if (!userResponse.ok) return failure();
    const discordUser = await userResponse.json() as { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
    if (!discordUser.id || !discordUser.username) return failure();
    const response = NextResponse.redirect(new URL('/', request.url));
    response.headers.append('Set-Cookie', makeSessionCookie({
      id: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
    }, request));
    response.headers.append('Set-Cookie', clearCookie('marovid_oauth_state', request));
    response.headers.append('Set-Cookie', clearCookie('marovid_pkce', request));
    return response;
  } catch (error) {
    console.error('Discord OAuth callback failed', error);
    return failure();
  }
}
