import crypto from 'crypto';
import { createSessionToken, getExpiredSessionCookies, getSessionCookie, type SessionTokenPayload, verifySessionToken } from './sessionToken';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const REFRESH_COOKIE_NAME = 'phlakesfabrics_refresh';
const LEGACY_REFRESH_COOKIE_NAME = 'phlakesfabrics_legacy_refresh';

export type AuthTokenPayload = Omit<SessionTokenPayload, 'iat' | 'exp'>;

export type AuthTokenBundle = {
  accessToken: string;
  refreshToken: string;
  accessCookie: string;
  refreshCookie: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
};

function parseCookies(cookieHeader: string | null) {
  return Object.fromEntries(
    (cookieHeader || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function hashAuthToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createRefreshCookie(token: string, maxAgeSeconds = REFRESH_TOKEN_TTL_SECONDS) {
  return `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function getExpiredRefreshCookie() {
  return `${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function getExpiredAuthCookies() {
  return [...getExpiredSessionCookies(), getExpiredRefreshCookie()];
}

export function createAuthTokenBundle(payload: AuthTokenPayload): AuthTokenBundle {
  const accessToken = createSessionToken({ ...payload, tokenType: 'access' }, ACCESS_TOKEN_TTL_SECONDS);
  const refreshToken = createSessionToken({ ...payload, tokenType: 'refresh' }, REFRESH_TOKEN_TTL_SECONDS);

  return {
    accessToken,
    refreshToken,
    accessCookie: getSessionCookie(accessToken, ACCESS_TOKEN_TTL_SECONDS),
    refreshCookie: createRefreshCookie(refreshToken, REFRESH_TOKEN_TTL_SECONDS),
    accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  };
}

export function getRefreshTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('x-refresh-token') || req.headers.get('X-Refresh-Token') || '';
  if (authHeader) {
    return authHeader.trim();
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[REFRESH_COOKIE_NAME] || cookies[LEGACY_REFRESH_COOKIE_NAME] || null;
}

export function verifyRefreshToken(token: string | null | undefined) {
  const payload = verifySessionToken(token);
  if (!payload || payload.tokenType !== 'refresh') return null;
  return payload;
}

export async function persistRefreshToken(user: any, refreshToken: string, refreshExpiresAt: Date) {
  if (!user) return;

  user.refreshTokenHash = hashAuthToken(refreshToken);
  user.refreshTokenIssuedAt = new Date();
  user.refreshTokenExpiresAt = refreshExpiresAt;
  await user.save();
}

export async function issueAuthTokensForUser(user: any, payload: AuthTokenPayload) {
  const bundle = createAuthTokenBundle(payload);
  await persistRefreshToken(user, bundle.refreshToken, bundle.refreshExpiresAt);
  return bundle;
}
