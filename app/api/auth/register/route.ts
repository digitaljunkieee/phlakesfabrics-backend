import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import corsHeaders from '../../../../lib/cors';
import { issueEmailVerificationCode } from '../../../../lib/emailVerification';

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? undefined, true) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined, true);

  try {
    const { firstName, lastName, email, phone, address, city, state, password } = await req.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400, headers });
    }

    await dbConnect();

    // Check if user already exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.emailVerified !== false) {
      return NextResponse.json({ success: false, error: 'User already exists with this email' }, { status: 409, headers });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const user =
      existingUser ||
      new User({
        email: normalizedEmail,
        role: 'customer',
      });

    user.name = `${firstName} ${lastName}`;
    user.email = normalizedEmail;
    user.password = hashedPassword;
    user.phone = phone;
    user.emailVerified = false;
    user.emailVerifiedAt = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    user.address = {
      line1: address,
      city,
      state,
    };

    await user.save();

    const verification = await issueEmailVerificationCode(user);
    if (!verification?.emailResult?.success) {
      if (!existingUser) {
        await User.findByIdAndDelete(user._id).catch(() => null);
      }

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
        success: true,
        requiresVerification: true,
        message: 'Verification code sent to your email address.',
        data: {
          email: user.email,
          expiresAt: verification.expiresAt,
        },
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, headers });
  }
}
