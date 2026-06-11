import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import Order from '../../../../../../models/Order';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../../lib/staffScope';
import { sendOrderStatusEmail } from '../../../../../../lib/email';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];
const LEGACY_STATUS_MAP: Record<string, string> = {
  unfulfilled: 'pending',
  fulfilled: 'packed',
  shipped: 'out_for_delivery',
};

function normalizeOrderStatus(value: unknown) {
  const status = cleanString(value).toLowerCase();
  return LEGACY_STATUS_MAP[status] || status;
}

export async function PATCH(req: NextRequest, ctx?: { params?: Promise<{ id: string }> }) {
  const params = ctx && ctx.params ? await ctx.params : undefined;
  const id = params?.id ?? undefined;
  if (!id) return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });

  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  const raw = await req.text();
  if (!raw || raw.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Missing request body' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (body.status !== undefined) allowed.fulfillmentStatus = normalizeOrderStatus(body.status);
  if (body.fulfillmentStatus !== undefined) allowed.fulfillmentStatus = normalizeOrderStatus(body.fulfillmentStatus);
  if (body.tracking_number !== undefined) allowed.trackingNumber = cleanString(body.tracking_number);
  if (body.trackingNumber !== undefined) allowed.trackingNumber = cleanString(body.trackingNumber);
  if (body.shipped_at !== undefined) allowed.shippedAt = body.shipped_at;
  if (body.shippedAt !== undefined) allowed.shippedAt = body.shippedAt;
  if (body.delivered_at !== undefined) allowed.deliveredAt = body.delivered_at;
  if (body.deliveredAt !== undefined) allowed.deliveredAt = body.deliveredAt;
  if (body.carrier !== undefined) allowed.carrier = cleanString(body.carrier);

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
  }

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const filter: Record<string, unknown> = { _id: id };
    if (scope.branchScoped) {
      filter.branch = scope.branchId;
    }

    const normalizedStatus = normalizeOrderStatus(allowed.fulfillmentStatus);
    if (normalizedStatus && !ORDER_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid order status. Use one of: ${ORDER_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const now = new Date();

    if (normalizedStatus === 'packed') {
      allowed.deliveryStatus = 'queued';
      if (!allowed.deliveryQueuedAt) allowed.deliveryQueuedAt = now;
    }

    if (normalizedStatus === 'out_for_delivery') {
      allowed.deliveryStatus = 'out_for_delivery';
      if (!allowed.shippedAt) allowed.shippedAt = now;
      if (!allowed.deliveryQueuedAt) allowed.deliveryQueuedAt = now;
      if (!allowed.deliveryOutForDeliveryAt) allowed.deliveryOutForDeliveryAt = now;
    }

    if (normalizedStatus === 'delivered') {
      allowed.deliveryStatus = 'delivered';
      if (!allowed.deliveredAt) allowed.deliveredAt = now;
    }

    if (normalizedStatus === 'cancelled') {
      allowed.deliveryStatus = 'cancelled';
    }

    allowed.deliveryUpdatedBy = auth.user?.id || null;

    const updatedOrder = await Order.findOneAndUpdate(filter, { $set: allowed }, { new: true, runValidators: true }).lean();
    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (['out_for_delivery', 'delivered'].includes(normalizedStatus)) {
      try {
        await sendOrderStatusEmail(updatedOrder);
      } catch (err) {
        console.warn('admin/orders/[id]/status: failed to send status email (non-fatal):', err);
      }
    }

    const updatedOrderRecord = updatedOrder as { _id?: { toString(): string } | string; id?: string };
    const formatted = {
      ...updatedOrder,
      id: updatedOrderRecord._id ? updatedOrderRecord._id.toString() : updatedOrderRecord.id,
    };
    return NextResponse.json({ success: true, order: formatted });
  } catch (err) {
    console.error('admin/orders/[id]/status: unexpected error', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
