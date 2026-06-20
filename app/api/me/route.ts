export {};

import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequest } from '../../../lib/auth'
import corsHeaders from '../../../lib/cors'
import dbConnect from '../../../lib/mongodb'
import User from '../../../models/User'

function formatUser(user: any) {
  const address = user.address || {}
  return {
    id: String(user._id || user.id),
    email: user.email ?? null,
    role: user.role ?? 'customer',
    name: user.name ?? null,
    phone: user.phone ?? '',
    branch: user.branch ? String(user.branch._id || user.branch.id || user.branch) : null,
    emailVerified: user.emailVerified !== false,
    address: address.line1 || address.street || user.address || '',
    city: address.city || user.city || '',
    state: address.state || user.state || '',
    country: address.country || '',
    zip: address.zip || '',
    created_at: user.createdAt ?? null,
    updated_at: user.updatedAt ?? null,
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? ''
  const headers = corsHeaders(origin, true)
  return new NextResponse(null, { status: 204, headers })
}

export async function GET(req: NextRequest, ctx?: { params?: Promise<any> }) {
  const origin = req.headers.get('origin') ?? ''
  const headers = corsHeaders(origin, true)

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers })

  try {
    return NextResponse.json({ success: true, data: { user: formatUser(user), profile: formatUser(user) } }, { headers })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers })
  }
}

export async function PATCH(req: NextRequest, ctx?: { params?: Promise<any> }) {
  const origin = req.headers.get('origin') ?? ''
  const headers = corsHeaders(origin, true)
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers })

  try {
    const body = await req.json()
    const name = body.name || body.full_name || [body.first_name, body.last_name].filter(Boolean).join(' ').trim()

    await dbConnect()
    const updated = await User.findByIdAndUpdate(
      user.id,
      {
        $set: {
          ...(name ? { name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          address: {
            line1: body.shipping_address || body.street_address || body.address || '',
            city: body.city || '',
            state: body.state || '',
            country: body.country || 'Nigeria',
            zip: body.zip || '',
          },
        },
      },
      { returnDocument: 'after', runValidators: true }
    ).select('-password').lean()

    if (!updated) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404, headers })
    return NextResponse.json({ success: true, data: formatUser(updated) }, { headers })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers })
  }
}

export async function DELETE(req: NextRequest, ctx?: { params?: Promise<any> }) {
  const origin = req.headers.get('origin') ?? ''
  const headers = corsHeaders(origin, true)
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers })

  try {
    await dbConnect()
    await User.findByIdAndDelete(user.id)
    return NextResponse.json({ success: true }, { headers })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers })
  }
}

export async function PUT(req: NextRequest) {
  return PATCH(req)
}
