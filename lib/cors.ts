

// Central CORS allowlist used across server routes. Keep this list minimal and
// explicit so we never accidentally return Access-Control-Allow-Credentials:
// true together with a wildcard origin.
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://phlakesfabrics-frontend.vercel.app',
  'https://www.phlakesfabrics.com',
  'https://phlakesfabrics.com',
]

export function getAllowedOrigin(origin?: string) {
  if (!origin) return ALLOWED_ORIGINS[0]
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

export function corsHeaders(origin?: string, allowCredentials?: boolean): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(origin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Only include credentials when explicitly requested or when an explicit
  // origin was provided (i.e. not wildcard). This prevents accidentally
  // returning Access-Control-Allow-Credentials: true together with '*'.
  const shouldAllowCredentials = Boolean(allowCredentials) || (origin != null && origin !== '*')
  if (shouldAllowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return headers
}

export default corsHeaders;
