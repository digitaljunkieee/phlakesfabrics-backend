import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../app/api/auth/[...nextauth]/route';
import dbConnect from './mongodb';
import User from '../models/User';
import { getSessionTokenFromRequest, verifySessionToken } from './sessionToken';
import { normalizeRole } from './roles';

type AppUser = Record<string, any> & {
  id: string;
  email?: string | null;
  role?: string | null;
  branch?: string | null;
};

function toAppUser(user: any): AppUser {
  const address = user.address || {};
  return {
    ...user,
    id: String(user._id || user.id),
    _id: undefined,
    password: undefined,
    email: user.email ?? null,
    role: normalizeRole(user.role),
    name: user.name ?? null,
    phone: user.phone ?? null,
    branch: user.branch ? String(user.branch._id || user.branch.id || user.branch) : null,
    address: address.line1 || address.street || '',
    city: address.city || '',
    state: address.state || '',
    country: address.country || '',
    zip: address.zip || '',
  };
}

async function getTokenUser(req: Request): Promise<AppUser | null> {
  const payload = verifySessionToken(getSessionTokenFromRequest(req));
  if (!payload?.sub) return null;

  await dbConnect();
  const dbUser = await User.findById(payload.sub).select('-password').lean();
  if (!dbUser) return null;
  return toAppUser(dbUser);
}

async function getNextAuthUser(): Promise<AppUser | null> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as any;

  if (!sessionUser?.id) {
    return null;
  }

  await dbConnect();
  const dbUser = await User.findById(sessionUser.id).select('-password').lean();

  if (dbUser) {
    return toAppUser(dbUser);
  }

  return {
    id: sessionUser.id,
    email: sessionUser.email ?? null,
    name: sessionUser.name ?? null,
    role: normalizeRole(sessionUser.role),
    branch: sessionUser.branch ?? null,
  };
}

export async function getUserFromRequest(req: Request): Promise<AppUser | null> {
  const tokenUser = await getTokenUser(req);
  if (tokenUser) return tokenUser;

  try {
    return await getNextAuthUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('outside a request scope') || message.includes('next-dynamic-api-wrong-context')) {
      return null;
    }
    throw error;
  }
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}
