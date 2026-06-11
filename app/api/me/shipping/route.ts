import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import { getUserFromRequest } from '../../../../lib/auth';

function formatShipping(order: unknown) {
  const candidate = order && typeof order === 'object' ? (order as Record<string, unknown>) : {};

  return {
    id: String(candidate._id || candidate.id || ''),
    order_id: String(candidate._id || candidate.id || ''),
    status: (candidate.fulfillmentStatus as string | undefined) || 'pending',
    delivery_status: (candidate.deliveryStatus as string | undefined) || 'pending',
    address: candidate.shippingAddress || null,
    tracking_number: (candidate.trackingNumber as string | undefined) || null,
    carrier: (candidate.carrier as string | undefined) || null,
    delivery_assigned_at: candidate.deliveryAssignedAt || null,
    delivery_queued_at: candidate.deliveryQueuedAt || null,
    delivery_out_for_delivery_at: candidate.deliveryOutForDeliveryAt || null,
    delivery_failure_reason: (candidate.deliveryFailureReason as string | undefined) || null,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt,
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

    return NextResponse.json({ items: orders.map(formatShipping), total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/me/shipping error', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
