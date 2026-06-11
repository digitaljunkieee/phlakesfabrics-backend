import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Branch from '../../../../models/Branch';
import Inventory from '../../../../models/Inventory';
import Order from '../../../../models/Order';
import SupportTicket from '../../../../models/SupportTicket';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

type OrderTotalDoc = {
  totalAmount?: number | string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const branchQuery = scope.branchScoped && scope.branchId ? { branch: scope.branchId } : {};

    const [totalOrders, pendingShipments, openTickets, paidToday] = await Promise.all([
      Order.countDocuments(branchQuery),
      Order.countDocuments({
        ...branchQuery,
        fulfillmentStatus: { $in: ['pending', 'confirmed', 'processing', 'packed', 'unfulfilled', 'fulfilled'] },
      }),
      SupportTicket.countDocuments({ status: { $ne: 'resolved' } }),
      Order.find({
        ...branchQuery,
        paymentStatus: 'paid',
        updatedAt: { $gte: startOfToday },
      })
        .select('totalAmount')
        .lean(),
    ]);

    const [totalBranches, lowStockItems] = await Promise.all([
      scope.branchScoped ? Promise.resolve(scope.branchId ? 1 : 0) : Branch.countDocuments({ isActive: { $ne: false } }),
      Inventory.countDocuments({
        ...branchQuery,
        status: { $in: ['low_stock', 'out_of_stock'] },
      }),
    ]);

    const paymentsToday = paidToday.reduce(
      (sum: number, order: OrderTotalDoc) => sum + (Number(order.totalAmount) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: { totalOrders, pendingShipments, openTickets, paymentsToday, totalBranches, lowStockItems },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/admin/overview error', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
