import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, 'admin');
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '20'), 1), 500);
    const skip = (page - 1) * limit;

    await dbConnect();
    const [orders, total] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({}),
    ]);

    const data = orders.map((order: any) => ({
      id: String(order._id),
      order_id: String(order._id),
      amount: order.totalAmount || 0,
      status: order.paymentStatus || 'pending',
      reference: order.paystackReference || String(order._id),
      email: order.email,
      created_at: order.createdAt,
    }));

    return NextResponse.json({ success: true, data, pagination: { page, limit, total } });
  } catch (err: any) {
    console.error('/api/admin/payments error', err);
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
