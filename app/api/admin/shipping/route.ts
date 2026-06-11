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

    const data = orders.map((order) => ({
      id: String(order._id),
      order_id: String(order._id),
      status: order.fulfillmentStatus || 'pending',
      delivery_status: order.deliveryStatus || 'pending',
      address: order.shippingAddress || null,
      tracking_number: order.trackingNumber || null,
      carrier: order.carrier || null,
      delivery_assigned_at: order.deliveryAssignedAt || null,
      delivery_queued_at: order.deliveryQueuedAt || null,
      delivery_out_for_delivery_at: order.deliveryOutForDeliveryAt || null,
      delivery_failure_reason: order.deliveryFailureReason || null,
      order: { id: String(order._id), total: order.totalAmount, email: order.email },
      customer: { email: order.email },
      created_at: order.createdAt,
    }));

    return NextResponse.json({ success: true, data, pagination: { page, limit, total } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/admin/shipping error', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
