// lib/adminGuard.ts
import { getUserFromRequest } from './auth';

export async function requireAdmin(req: Request) {
  const user = await getUserFromRequest(req);

  // Check if user exists and has the admin role
  if (!user || user.role !== 'admin') {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden: Admin access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { authorized: true, user };
}