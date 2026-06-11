import { NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import Branch from '../../../../../../models/Branch';
import Order from '../../../../../../models/Order';
import Product from '../../../../../../models/Product';
import User from '../../../../../../models/User';
import { sendOrderStatusEmail } from '../../../../../../lib/email';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../../lib/staffScope';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function resolveId(value: unknown) {
  if (!value) return null;
  const record = asRecord(value);
  return cleanString(record._id || record.id || value) || null;
}

function formatOrder(order: unknown, currentUserId?: string | null) {
  const candidate = order as { toObject?: () => unknown } | null;
  const raw = typeof candidate?.toObject === 'function' ? asRecord(candidate.toObject()) : asRecord(order);
  const branchRecord = asRecord(raw.branch);
  const customerRecord = asRecord(raw.user);
  const assignedRecord = asRecord(raw.deliveryAssignedTo);
  const assignedId = cleanString(assignedRecord._id || assignedRecord.id || raw.deliveryAssignedTo);

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    branch:
      Object.keys(branchRecord).length > 0
        ? {
            id: String(branchRecord._id || branchRecord.id || ''),
            name: (branchRecord.name as string | null | undefined) || null,
            slug: (branchRecord.slug as string | null | undefined) || null,
            code: (branchRecord.code as string | null | undefined) || null,
          }
        : raw.branch || null,
    branchName: (raw.branchName as string | null | undefined) || (branchRecord.name as string | null | undefined) || null,
    customer:
      Object.keys(customerRecord).length > 0
        ? {
            id: String(customerRecord._id || customerRecord.id || ''),
            name: (customerRecord.name as string | null | undefined) || null,
            email: (customerRecord.email as string | null | undefined) || null,
            phone: (customerRecord.phone as string | null | undefined) || null,
          }
        : raw.user || null,
    deliveryAssignedTo:
      Object.keys(assignedRecord).length > 0
        ? {
            id: String(assignedRecord._id || assignedRecord.id || ''),
            name: (assignedRecord.name as string | null | undefined) || null,
            email: (assignedRecord.email as string | null | undefined) || null,
            role: (assignedRecord.role as string | null | undefined) || null,
          }
        : raw.deliveryAssignedTo || null,
    assignedToMe: Boolean(currentUserId && assignedId === currentUserId),
    paymentStatus: (raw.paymentStatus as string | null | undefined) || 'pending',
    fulfillmentStatus: (raw.fulfillmentStatus as string | null | undefined) || 'pending',
    deliveryStatus: (raw.deliveryStatus as string | null | undefined) || 'pending',
    trackingNumber: (raw.trackingNumber as string | null | undefined) || null,
    carrier: (raw.carrier as string | null | undefined) || null,
    shippingAddress: raw.shippingAddress || null,
    deliveryQueuedAt: raw.deliveryQueuedAt || null,
    deliveryAssignedAt: raw.deliveryAssignedAt || null,
    deliveryOutForDeliveryAt: raw.deliveryOutForDeliveryAt || null,
    deliveryFailureReason: (raw.deliveryFailureReason as string | null | undefined) || null,
    deliveryNotes: (raw.deliveryNotes as string | null | undefined) || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function parseRequestBody(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'delivery']);
  if (!auth.authorized) return auth.response;

  const { id: orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });
  }

  const rawBody = await req.text();
  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Missing request body' }, { status: 400 });
  }

  const body = parseRequestBody(rawBody);
  if (!body) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalizedStatus = cleanString(body.status || body.deliveryStatus || body.action).toLowerCase();
  const assignToMe = Boolean(body.assignToMe);
  const deliveryNotes = body.deliveryNotes !== undefined ? cleanString(body.deliveryNotes) || null : undefined;
  const deliveryFailureReason = body.deliveryFailureReason !== undefined
    ? cleanString(body.deliveryFailureReason) || null
    : body.failureReason !== undefined
      ? cleanString(body.failureReason) || null
      : undefined;

  if (!normalizedStatus && !assignToMe && deliveryNotes === undefined && deliveryFailureReason === undefined) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
  }

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const filter: Record<string, unknown> = { _id: orderId };
    if (scope.branchScoped) {
      filter.branch = scope.branchId;
    }

    const order = await Order.findOne(filter)
      .populate({ path: 'branch', select: 'name slug code isActive address', model: Branch })
      .populate({ path: 'user', select: 'name email phone', model: User })
      .populate({ path: 'deliveryAssignedTo', select: 'name email role branch', model: User })
      .populate({ path: 'items.product', select: 'name title slug price images', model: Product });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const fulfillmentStatus = cleanString(order.fulfillmentStatus).toLowerCase();
    const deliverableStatuses = ['packed', 'out_for_delivery', 'shipped'];
    if ((normalizedStatus || assignToMe) && !deliverableStatuses.includes(fulfillmentStatus)) {
      return NextResponse.json(
        { success: false, error: 'Only packed or out-for-delivery orders can be updated from the delivery queue' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      deliveryUpdatedBy: auth.user?.id || null,
    };

    if (deliveryNotes !== undefined) {
      updates.deliveryNotes = deliveryNotes;
    }
    if (deliveryFailureReason !== undefined) {
      updates.deliveryFailureReason = deliveryFailureReason;
    }

    if (assignToMe || normalizedStatus === 'assigned') {
      updates.deliveryStatus = 'assigned';
      updates.deliveryAssignedTo = auth.user?.id || null;
      if (!order.deliveryAssignedAt) updates.deliveryAssignedAt = now;
      if (!order.deliveryQueuedAt) updates.deliveryQueuedAt = now;
    }

    if (normalizedStatus === 'queued') {
      updates.deliveryStatus = 'queued';
      if (!order.deliveryQueuedAt) updates.deliveryQueuedAt = now;
    }

    if (normalizedStatus === 'out_for_delivery') {
      updates.deliveryStatus = 'out_for_delivery';
      updates.fulfillmentStatus = 'out_for_delivery';
      updates.deliveryAssignedTo = resolveId(order.deliveryAssignedTo) || auth.user?.id || null;
      if (!order.deliveryAssignedAt) updates.deliveryAssignedAt = now;
      if (!order.deliveryQueuedAt) updates.deliveryQueuedAt = now;
      updates.deliveryOutForDeliveryAt = now;
    }

    if (normalizedStatus === 'delivered') {
      updates.deliveryStatus = 'delivered';
      updates.fulfillmentStatus = 'delivered';
      if (!order.deliveredAt) updates.deliveredAt = now;
      if (!resolveId(order.deliveryAssignedTo) && auth.user?.id) {
        updates.deliveryAssignedTo = auth.user.id;
      }
    }

    if (normalizedStatus === 'failed') {
      updates.deliveryStatus = 'failed';
    }

    if (normalizedStatus === 'returned') {
      updates.deliveryStatus = 'returned';
    }

    if (normalizedStatus === 'cancelled') {
      updates.deliveryStatus = 'cancelled';
      updates.fulfillmentStatus = 'cancelled';
    }

    if (Object.keys(updates).length === 1 && updates.deliveryUpdatedBy) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    Object.assign(order, updates);
    await order.save();

    const formatted = formatOrder(order, auth.user?.id || null);

    if (formatted.deliveryStatus === 'delivered' || formatted.fulfillmentStatus === 'delivered') {
      try {
        await sendOrderStatusEmail(formatted);
      } catch (err) {
        console.warn('/api/delivery/orders/[id]/status: failed to send delivery email (non-fatal):', err);
      }
    }

    return NextResponse.json({ success: true, order: formatted }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/delivery/orders/[id]/status error', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
