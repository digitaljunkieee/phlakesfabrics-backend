import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import { getUserFromRequest } from '../../../../lib/auth';

function formatPayment(order: any) {
  return {
    id: String(order._id || order.id),
    order_id: String(order._id || order.id),
    amount: order.totalAmount || 0,
    status: order.paymentStatus || 'pending',
    reference: order.paystackReference || String(order._id || order.id),
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 500);
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);

    await dbConnect();
    const query = { $or: [{ user: user.id }, { email: user.email }] };
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({ items: orders.map(formatPayment), total });
  } catch (err: any) {
    console.error('/api/me/payments error', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
