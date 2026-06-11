import { NextResponse, NextRequest } from 'next/server';
import corsHeaders from '../../../../lib/cors';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { getExpiredAuthCookies, getRefreshTokenFromRequest, verifyRefreshToken } from '../../../../lib/authTokens';
import { getSessionTokenFromRequest, verifySessionToken } from '../../../../lib/sessionToken';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);

  try {
    const accessPayload = verifySessionToken(getSessionTokenFromRequest(req));
    const refreshPayload = verifyRefreshToken(getRefreshTokenFromRequest(req));
    const subject = refreshPayload?.sub || accessPayload?.sub || null;

    if (subject) {
      await dbConnect();
      await User.findByIdAndUpdate(subject, {
        $set: {
          refreshTokenHash: null,
          refreshTokenIssuedAt: null,
          refreshTokenExpiresAt: null,
        },
      });
    }
  } catch (error) {
    console.warn('/api/auth/logout failed to clear refresh token state', error);
  }

  const response = NextResponse.json({ success: true }, { headers });
  for (const cookie of getExpiredAuthCookies()) {
    response.headers.append('Set-Cookie', cookie);
  }
  return response;
}
