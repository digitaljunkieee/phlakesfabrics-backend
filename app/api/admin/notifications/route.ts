import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import Order from '../../../../models/Order';
import SupportTicket from '../../../../models/SupportTicket';

export async function GET(req: Request) {
  const auth = await requireAuthWithRole(req, 'admin');
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();

    const [orders, tickets] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      SupportTicket.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const notifications = [
      ...orders.map((order: any) => ({
        id: `order-${order._id}`,
        type: 'order',
        message: `New order received from ${order.email || 'customer'}`,
        created_at: order.createdAt,
        read: false,
      })),
      ...tickets.map((ticket: any) => ({
        id: `ticket-${ticket._id}`,
        type: 'support',
        message: `New support ticket: ${ticket.subject || 'Customer message'}`,
        created_at: ticket.createdAt,
        read: false,
      })),
    ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 15);

    return NextResponse.json({ notifications }, { status: 200 });
  } catch (err: any) {
    console.error('/api/admin/notifications error', err);
    return NextResponse.json({ notifications: [], error: err?.message || 'Failed to load notifications' }, { status: 500 });
  }
}
