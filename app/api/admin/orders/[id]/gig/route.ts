import { NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import Order from '../../../../../../models/Order';
import Product from '../../../../../../models/Product';
import User from '../../../../../../models/User';
import { sendOrderStatusEmail } from '../../../../../../lib/email';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../../lib/staffScope';
import { createGigWaybill } from '../../../../../../lib/gigService';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is missing from the URL' }, { status: 400 });
    }

    const orderFilter: Record<string, unknown> = { _id: orderId };
    if (scope.branchScoped) {
      orderFilter.branch = scope.branchId;
    }

    const order = await Order.findOne(orderFilter)
      .populate({ path: 'items.product', model: Product })
      .populate({ path: 'user', model: User });

    if (!order) {
      return NextResponse.json({ error: `Order not found for ID: ${orderId}` }, { status: 404 });
    }

    if (['out_for_delivery', 'shipped', 'delivered'].includes(String(order.fulfillmentStatus || '').toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Order is already dispatched' }, { status: 400 });
    }

    if (order.paymentStatus !== 'paid') {
      return NextResponse.json({ success: false, error: 'Only paid orders can be dispatched with GIG' }, { status: 400 });
    }

    const waybillNumber = await createGigWaybill(order, 'preshipment');

    if (!waybillNumber) {
      throw new Error('GIG did not return a valid Waybill number. Check API connection.');
    }

    order.fulfillmentStatus = 'out_for_delivery';
    order.deliveryStatus = 'queued';
    order.trackingNumber = waybillNumber;
    order.carrier = 'GIG Logistics';
    order.shippedAt = new Date();
    order.deliveryQueuedAt = order.deliveryQueuedAt || new Date();
    order.deliveryUpdatedBy = auth.user?.id || null;

    await order.save();

    try {
      await sendOrderStatusEmail(order);
    } catch (err) {
      console.warn('admin/orders/[id]/gig: failed to send out-for-delivery email (non-fatal):', err);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Waybill created successfully',
        order,
        waybill: waybillNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GIG Automated Dispatch Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to dispatch via GIG';
    const status = message.toLowerCase().includes('wallet') ? 402 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
