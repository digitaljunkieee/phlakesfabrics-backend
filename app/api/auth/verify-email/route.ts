import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import corsHeaders from '../../../../lib/cors';
import { verifyEmailVerificationCode } from '../../../../lib/emailVerification';
import { issueAuthTokensForUser } from '../../../../lib/authTokens';

function sanitizeUser(user: any) {
  const address = user.address || {};
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role || 'customer',
    phone: user.phone || '',
    emailVerified: user.emailVerified !== false,
    address: address.line1 || '',
    city: address.city || '',
    state: address.state || '',
    branch: user.branch ? user.branch.toString() : null,
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);

  try {
    const { email, code } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const verificationCode = String(code || '').trim();

    if (!normalizedEmail || !verificationCode) {
      return NextResponse.json({ success: false, error: 'Email and verification code are required' }, { status: 400, headers });
    }

    await dbConnect();
    const user = await verifyEmailVerificationCode({ email: normalizedEmail, code: verificationCode });
    const safeUser = sanitizeUser(user);
    const { accessToken, accessCookie, refreshCookie } = await issueAuthTokensForUser(user, {
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name,
      branch: safeUser.branch,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: { user: safeUser, token: accessToken },
    }, { headers });
    response.headers.append('Set-Cookie', accessCookie);
    response.headers.append('Set-Cookie', refreshCookie);
    return response;
  } catch (error: any) {
    console.error('/api/auth/verify-email error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to verify email' }, { status: 400, headers });
  }
}
