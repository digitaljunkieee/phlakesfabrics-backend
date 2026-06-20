export {};

import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequest } from '../../../../lib/auth'
import corsHeaders from '../../../../lib/cors'
import { OPERATIONAL_ROLES, normalizeRole } from '../../../../lib/roles'

// Support preflight for admin endpoints. We echo origin and allow credentials
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? undefined
  const headers = corsHeaders(origin, true)
  return new NextResponse(null, { status: 204, headers })
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      const headers = corsHeaders(req.headers.get('origin') ?? undefined, true)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    const role = normalizeRole((user as any)?.role)
    if (!OPERATIONAL_ROLES.includes(role)) {
      const headers = corsHeaders(req.headers.get('origin') ?? undefined, true)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers })
    }

    // Return minimal non-sensitive admin info
    const headers = corsHeaders(req.headers.get('origin') ?? undefined, true)
    return NextResponse.json({
      id: (user as any)?.id ?? null,
      email: (user as any)?.email ?? null,
      role,
      branch: (user as any)?.branch ?? null,
      created_at: (user as any)?.created_at ?? null,
    }, { headers })
  } catch (err: any) {
    console.error('admin/me: unexpected error', err)
    const headers = corsHeaders(req.headers.get('origin') ?? undefined, true)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers })
  }
}
 
