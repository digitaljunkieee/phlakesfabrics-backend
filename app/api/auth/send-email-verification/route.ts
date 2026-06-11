import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { issueEmailVerificationCode } from '../../../../lib/emailVerification';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);

  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400, headers });
    }

    await dbConnect();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.emailVerified !== false) {
      return NextResponse.json({
        success: true,
        message: 'If that email is registered, a verification code has been sent.',
      }, { headers });
    }

    const verification = await issueEmailVerificationCode(user);
    if (!verification?.emailResult?.success) {
      return NextResponse.json(
        { success: false, error: verification?.emailResult?.message || 'Unable to send verification email' },
        { status: 503, headers }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email address.',
      data: {
        email: user.email,
        expiresAt: verification.expiresAt,
      },
    }, { headers });
  } catch (error: any) {
    console.error('/api/auth/send-email-verification error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send verification email' }, { status: 500, headers });
  }
}
