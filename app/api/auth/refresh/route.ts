import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { getRefreshTokenFromRequest, hashAuthToken, issueAuthTokensForUser, verifyRefreshToken } from '../../../../lib/authTokens';
import { normalizeRole } from '../../../../lib/roles';

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
    const refreshToken = getRefreshTokenFromRequest(req);
    const payload = verifyRefreshToken(refreshToken);

    if (!refreshToken || !payload?.sub) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers });
    }

    await dbConnect();
    const user = await User.findById(payload.sub);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers });
    }

    const storedHash = String(user.refreshTokenHash || '');
    const incomingHash = hashAuthToken(refreshToken);
    const expiresAt = user.refreshTokenExpiresAt ? new Date(user.refreshTokenExpiresAt) : null;

    if (!storedHash || storedHash !== incomingHash || (expiresAt && expiresAt.getTime() < Date.now())) {
      user.refreshTokenHash = null;
      user.refreshTokenIssuedAt = null;
      user.refreshTokenExpiresAt = null;
      await user.save().catch(() => null);
      return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401, headers });
    }

    const safeUser = sanitizeUser(user);
    const { accessToken, accessCookie, refreshCookie } = await issueAuthTokensForUser(user, {
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name,
      branch: safeUser.branch,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: safeUser,
          token: accessToken,
          accessToken,
          access_token: accessToken,
        },
      },
      { headers }
    );
    response.headers.append('Set-Cookie', accessCookie);
    response.headers.append('Set-Cookie', refreshCookie);
    return response;
  } catch (error: any) {
    console.error('/api/auth/refresh error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to refresh session' }, { status: 500, headers });
  }
}
