import './lib/startupChecks'
import { NextResponse, NextRequest } from 'next/server'

// Global CORS middleware - single place to manage CORS for /api/*
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://phlakesfabrics.vercel.app',
  'https://phlakesfabrics-frontend.vercel.app',
  'https://www.phlakesfabrics.com',
  'https://phlakesfabrics.com',
])

function makeCorsHeaders(origin: string | null): Headers {
  const headers = new Headers()

  const originValue = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''

  // Always set the CORS allow headers requested by the project.
  // Access-Control-Allow-Origin is only echoed when the origin is allowed
  // (never '*').
  if (originValue) {
    headers.set('Access-Control-Allow-Origin', originValue)
  }
  // These headers are set always per the requirement.
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Max-Age', '600')
  headers.set('Vary', 'Origin')
  return headers
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = makeCorsHeaders(origin)

  // Preflight handling: respond with 200 and the CORS headers.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers })
  }

  const res = NextResponse.next()
  headers.forEach((value, key) => res.headers.set(key, value))
  return res
}

export const config = {
  matcher: ['/api/:path*'],
}

// force redeployment test change again

