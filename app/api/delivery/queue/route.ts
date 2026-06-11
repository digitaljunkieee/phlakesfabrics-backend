import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Branch from '../../../../models/Branch';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product';
import User from '../../../../models/User';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'delivery']);
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '25'), 1), 100);
    const skip = (page - 1) * limit;
    const status = cleanString(url.searchParams.get('status')).toLowerCase();
    const requestedBranchId = cleanString(url.searchParams.get('branchId') || url.searchParams.get('branch'));
    const mineOnly = ['1', 'true', 'yes'].includes(cleanString(url.searchParams.get('mineOnly')).toLowerCase());
    const assignedOnly = ['1', 'true', 'yes'].includes(cleanString(url.searchParams.get('assignedOnly')).toLowerCase());

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const query: Record<string, unknown> = {
      paymentStatus: 'paid',
      fulfillmentStatus: { $in: ['packed', 'out_for_delivery', 'shipped'] },
      deliveryStatus: { $ne: 'delivered' },
      fulfillmentType: { $ne: 'pickup' },
    };

    if (scope.branchScoped) {
      if (requestedBranchId && requestedBranchId !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      query.branch = scope.branchId;
    } else if (requestedBranchId) {
      query.branch = requestedBranchId;
    }

    if (status && status !== 'all') {
      query.deliveryStatus = status;
    }

    if (mineOnly || assignedOnly) {
      query.deliveryAssignedTo = auth.user?.id || null;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate({ path: 'branch', select: 'name slug code isActive address', model: Branch })
        .populate({ path: 'user', select: 'name email phone', model: User })
        .populate({ path: 'deliveryAssignedTo', select: 'name email role branch', model: User })
        .populate({ path: 'items.product', select: 'name title slug price images', model: Product })
        .sort({ deliveryQueuedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const data = orders.map((order) => formatOrder(order, auth.user?.id || null));

    return NextResponse.json({
      success: true,
      data,
      orders: data,
      pagination: { page, limit, total },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/delivery/queue error', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
