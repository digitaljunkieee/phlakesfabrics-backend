import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import User from '../../../../models/User';
import Product from '../../../../models/Product';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ error: 'Branch assignment required' }, { status: 403 });
    }

    const query = scope.branchScoped && scope.branchId ? { branch: scope.branchId } : {};

    // Force-bind the Product and User models so Next.js keeps the populated references.
    const orders = await Order.find(query)
      .populate({
        path: 'user',
        select: 'name email',
        model: User,
      })
      .populate({
        path: 'items.product',
        select: 'name title price images',
        model: Product,
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((o) => ({ ...o, id: o._id.toString(), _id: undefined }));
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Admin Order Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin orders' }, { status: 500 });
  }
}
