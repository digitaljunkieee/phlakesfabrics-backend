import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';
import { normalizeRole } from '../../../../lib/roles';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff', 'delivery']);
  if (!auth.authorized) return auth.response;

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = normalizeRole(user.role);

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      role,
      branch: user.branch ?? null,
      phone: user.phone ?? null,
    },
  });
}
