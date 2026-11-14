import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type AuthUser = { id: string; username: string; avatar: string | null };
type Session = { user: AuthUser; expiresAt: number };
const sessionCookie = 'marovid_session';
const sessionAge = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return value;
}
function signature(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}
function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const entry of cookieHeader.split(';')) {
    const [key, ...parts] = entry.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return null;
}
export function createOAuthState() {
  return randomBytes(32).toString('base64url');
}
export function createPkceVerifier() {
  return randomBytes(48).toString('base64url');
}
export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}
export function secureCookie(name: string, value: string, request: Request, maxAge: number, extra = '') {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}${extra}`;
}
export function clearCookie(name: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
export function oauthStateCookie(state: string, request: Request) {
  return secureCookie('marovid_oauth_state', state, request, 600);
}
export function pkceCookie(verifier: string, request: Request) {
  return secureCookie('marovid_pkce', verifier, request, 600);
}
export function makeSessionCookie(user: AuthUser, request: Request) {
  const payload = Buffer.from(JSON.stringify({ user, expiresAt: Date.now() + sessionAge * 1000 } satisfies Session)).toString('base64url');
  const value = `${payload}.${signature(payload)}`;
  return secureCookie(sessionCookie, value, request, sessionAge);
}
export function getSession(request: Request): AuthUser | null {
  try {
    const value = cookieValue(request, sessionCookie);
    if (!value) return null;
    const [payload, suppliedSignature] = value.split('.');
    if (!payload || !suppliedSignature) return null;
    const expected = Buffer.from(signature(payload));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (!session.user?.id || !session.user.username || session.expiresAt <= Date.now()) return null;
    return session.user;
  } catch {
    return null;
  }
}
export function getCookie(request: Request, name: string) {
  return cookieValue(request, name);
}
export function createOAuthPkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}
