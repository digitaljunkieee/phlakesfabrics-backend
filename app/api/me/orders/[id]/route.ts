import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Order from '../../../../../models/Order';
import Product from '../../../../../models/Product';
import Branch from '../../../../../models/Branch';
import { getUserFromRequest } from '../../../../../lib/auth';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function formatOrder(order: any) {
  const raw = typeof order?.toObject === 'function' ? order.toObject() : order;

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    total: Number(raw.totalAmount || raw.total || 0),
    subtotal: Number(raw.subtotal || raw.totalAmount || raw.total || 0),
    branchName: raw.branchName || raw.branch?.name || null,
    pickupBranchName: raw.pickupBranchName || raw.pickupBranch?.name || null,
    items: (raw.items || []).map((item: any) => ({
      ...item,
      product: item.product,
      name: item.name || item.product?.name || item.product?.title || 'Fabric',
      image: item.product?.image || item.product?.images?.[0] || item.image || null,
      productId: cleanString(item.product?._id || item.product?.id || item.product),
      unit: item.unit || item.selectedUnit || null,
      fulfillmentType: item.fulfillmentType || raw.fulfillmentType || 'delivery',
      pickupBranchName: item.pickupBranchName || raw.pickupBranchName || raw.pickupBranch?.name || null,
    })),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = cleanString(id);
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    await dbConnect();
    const order = await Order.findOne({ _id: orderId, user: user.id })
      .populate({ path: 'items.product', select: 'name title slug image images price', model: Product })
      .populate({ path: 'branch', select: 'name slug code address', model: Branch })
      .populate({ path: 'pickupBranch', select: 'name slug code address', model: Branch })
      .lean();

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { order: formatOrder(order) } }, { status: 200 });
  } catch (error) {
    console.error('/api/me/orders/[id] error', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
