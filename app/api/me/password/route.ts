import { NextResponse, NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { getUserFromRequest } from '../../../../lib/auth';
import corsHeaders from '../../../../lib/cors';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function PATCH(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers });

  try {
    const { password } = await req.json();
    if (!password || String(password).length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400, headers });
    }

    await dbConnect();
    await User.findByIdAndUpdate(user.id, { $set: { password: await bcrypt.hash(password, 10) } });
    return NextResponse.json({ success: true }, { headers });
  } catch (error: any) {
    console.error('Password update error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update password' }, { status: 500, headers });
  }
}
