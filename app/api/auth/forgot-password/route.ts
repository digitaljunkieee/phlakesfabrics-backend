import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { sendPasswordResetEmail } from '../../../../lib/email';

function buildFrontendUrl(path: string) {
  const base = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}${path}`;
}

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

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetToken = tokenHash;
      user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 60);
      await user.save();

      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl: buildFrontendUrl(`/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`),
      });

      if (!emailResult?.success) {
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        return NextResponse.json(
          {
            success: false,
            error: emailResult?.message || 'Unable to send password reset email',
          },
          { status: 503, headers }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    }, { headers });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to request password reset' }, { status: 500, headers });
  }
}
