import crypto from 'crypto';
import dbConnect from './mongodb';
import User from '../models/User';
import { EMAIL_VERIFICATION_OTP_TTL_MINUTES, sendEmailVerificationOtpEmail } from './email';

function generateOtp(length = 6) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, '0');
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

function getFrontendBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
}

export function buildEmailVerificationUrl(email: string) {
  const base = getFrontendBaseUrl();
  return `${base}/verify-email?email=${encodeURIComponent(String(email || '').trim().toLowerCase())}`;
}

export async function issueEmailVerificationCode(user: any) {
  if (!user?.email) {
    throw new Error('User email is required');
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_OTP_TTL_MINUTES * 60 * 1000);

  user.emailVerified = false;
  user.emailVerifiedAt = null;
  user.emailVerificationToken = hashCode(code);
  user.emailVerificationExpires = expiresAt;
  await user.save();

  const emailResult = await sendEmailVerificationOtpEmail({
    email: user.email,
    name: user.name,
    code,
    verificationUrl: buildEmailVerificationUrl(user.email),
    expiresAt,
  });

  if (!emailResult?.success) {
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
  }

  return { code, expiresAt, emailResult };
}

export async function verifyEmailVerificationCode({
  email,
  code,
}: {
  email: string;
  code: string;
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const sanitizedCode = String(code || '').replace(/\D/g, '').slice(0, 10);

  if (!normalizedEmail || !sanitizedCode) {
    throw new Error('Email and verification code are required');
  }

  await dbConnect();
  const user = await User.findOne({
    email: normalizedEmail,
    emailVerificationToken: hashCode(sanitizedCode),
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error('Invalid or expired verification code');
  }

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  return user;
}
