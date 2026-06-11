import { NextResponse, NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { ensureConfiguredAdminUser } from '../../../../lib/adminUser';
import { issueEmailVerificationCode } from '../../../../lib/emailVerification';
import { normalizeRole } from '../../../../lib/roles';
import { issueAuthTokensForUser } from '../../../../lib/authTokens';

function sanitizeUser(user: any) {
  const address = user.address || {};
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
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
    const { email, identifier, password } = await req.json();
    const loginEmail = String(email || identifier || '').trim().toLowerCase();
    if (!loginEmail || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400, headers });
    }

    await dbConnect();
    await ensureConfiguredAdminUser(loginEmail);
    const user = await User.findOne({ email: loginEmail });
    if (!user?.password) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401, headers });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401, headers });
    }

    if (user.isActive === false || String(user.status || '').toLowerCase() === 'suspended') {
      return NextResponse.json({ success: false, error: 'This account has been suspended. Contact the store administrator.' }, { status: 403, headers });
    }

    if (user.emailVerified === false) {
      const verification = await issueEmailVerificationCode(user);
      if (!verification?.emailResult?.success) {
        return NextResponse.json(
          {
            success: false,
            error: verification?.emailResult?.message || 'Unable to send verification email',
          },
          { status: 503, headers }
        );
      }

      return NextResponse.json(
        {
          success: false,
          requiresVerification: true,
          error: 'Verify your email address before signing in.',
          data: {
            email: user.email,
            expiresAt: verification.expiresAt,
          },
        },
        { status: 403, headers }
      );
    }

    const safeUser = sanitizeUser(user);
    const { accessToken, accessCookie, refreshCookie } = await issueAuthTokensForUser(user, {
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name,
      branch: safeUser.branch,
    });

    const response = NextResponse.json({ success: true, data: { user: safeUser, token: accessToken } }, { headers });
    response.headers.append('Set-Cookie', accessCookie);
    response.headers.append('Set-Cookie', refreshCookie);
    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Login failed' }, { status: 500, headers });
  }
}
