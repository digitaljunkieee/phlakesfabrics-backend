import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'phlakesfabrics_session';
const LEGACY_SESSION_COOKIE_NAME = 'phlakesfabrics_legacy_session';

export type SessionTokenPayload = {
  sub: string;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  branch?: string | null;
  tokenType?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('SESSION_SECRET or NEXTAUTH_SECRET must be configured');
  return secret;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(input: string) {
  return crypto.createHmac('sha256', getSecret()).update(input).digest('base64url');
}

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

export function createSessionToken(payload: Omit<SessionTokenPayload, 'iat' | 'exp'>, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(body));
  const unsigned = `${header}.${encodedPayload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token: string | null | undefined): SessionTokenPayload | null {
  if (!token) return null;

  const [header, payload, signature] = String(token).split('.');
  if (!header || !payload || !signature) return null;

  const unsigned = `${header}.${payload}`;
  const expected = sign(unsigned);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getSessionTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[SESSION_COOKIE_NAME] || cookies[LEGACY_SESSION_COOKIE_NAME] || null;
}

export function getSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function getExpiredSessionCookie() {
  return getExpiredSessionCookies()[0];
}

export function getExpiredSessionCookies() {
  const expired = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  const legacyExpired = `${LEGACY_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return [expired, legacyExpired];
}
