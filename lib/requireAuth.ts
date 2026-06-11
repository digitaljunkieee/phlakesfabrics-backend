import { NextResponse } from 'next/server';
import { getUserFromRequest } from './auth';
import { normalizeRole } from './roles';

export async function requireAuthWithRole(req: Request, requiredRole: string | string[]) {
  const user = await getUserFromRequest(req);
  if (!user) return { authorized: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (!roles.includes('super_admin')) roles.push('super_admin');
  const userRole = normalizeRole(user.role);
  if (!roles.includes(userRole)) return { authorized: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { authorized: true, user };
}
