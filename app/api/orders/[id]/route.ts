import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import { getUserFromRequest } from '../../../../lib/auth';
import { isAdminRole } from '../../../../lib/roles';
import Branch from '../../../../models/Branch';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product';
import User from '../../../../models/User';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function buildOrderLookup(identifier: string) {
  const clauses: Record<string, unknown>[] = [
    { orderNumber: identifier },
    { paystackReference: identifier },
    { trackingNumber: identifier },
  ];
  if (mongoose.Types.ObjectId.isValid(identifier)) clauses.unshift({ _id: identifier });
  return { $or: clauses };
}

function formatOrder(order: any) {
  const raw = typeof order?.toObject === 'function' ? order.toObject() : order;
  const branch = raw.branch && typeof raw.branch === 'object' ? raw.branch : null;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    customer: user ? { id: String(user._id || user.id || ''), name: user.name || null, email: user.email || null } : null,
    branch: branch ? { id: String(branch._id || branch.id || ''), name: branch.name || null, code: branch.code || null } : raw.branch || null,
    branchName: raw.branchName || branch?.name || null,
    total: Number(raw.totalAmount || raw.total || 0),
    items: (raw.items || []).map((item: any) => ({
      ...item,
      productId: cleanString(item.product?._id || item.product?.id || item.product),
      name: item.name || item.product?.name || item.product?.title || 'Product',
      image: item.image || item.product?.image || item.product?.images?.[0] || null,
    })),
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const identifier = cleanString(id);
    if (!identifier) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    await dbConnect();
    const order = await Order.findOne(buildOrderLookup(identifier))
      .populate({ path: 'user', select: 'name email phone', model: User })
      .populate({ path: 'branch', select: 'name slug code address', model: Branch })
      .populate({ path: 'pickupBranch', select: 'name slug code address', model: Branch })
      .populate({ path: 'items.product', select: 'name title slug image images price', model: Product })
      .lean();

    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    const user = await getUserFromRequest(req);
    const emailParam = cleanString(new URL(req.url).searchParams.get('email')).toLowerCase();
    const orderUserId = cleanString((order as any).user?._id || (order as any).user?.id || (order as any).user);
    const orderEmail = cleanString((order as any).email || (order as any).user?.email).toLowerCase();
    const canView =
      Boolean(user && (isAdminRole(user.role) || cleanString(user.id) === orderUserId)) ||
      Boolean(emailParam && orderEmail && emailParam === orderEmail);

    if (!canView) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: user ? 403 : 401 });
    }

    return NextResponse.json({ success: true, data: { order: formatOrder(order) }, order: formatOrder(order) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load order';
    console.error('/api/orders/[id] GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
