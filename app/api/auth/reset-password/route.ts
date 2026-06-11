import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { sendPasswordChangedEmail } from '../../../../lib/email';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);

  try {
    const { email, token, password, confirmPassword } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const resetToken = String(token || '').trim();

    if (!normalizedEmail || !resetToken || !password || !confirmPassword) {
      return NextResponse.json({ success: false, error: 'Email, token and password are required' }, { status: 400, headers });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'Passwords do not match' }, { status: 400, headers });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400, headers });
    }

    await dbConnect();
    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetToken: hashToken(resetToken),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid or expired reset token' }, { status: 400, headers });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    await sendPasswordChangedEmail({
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' }, { headers });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to reset password' }, { status: 500, headers });
  }
}
