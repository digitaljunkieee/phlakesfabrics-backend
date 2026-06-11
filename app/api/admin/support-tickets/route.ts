import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import SupportTicket from '../../../../models/SupportTicket';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { sendSupportTicketStatusUpdateEmail } from '../../../../lib/email';

function formatTicket(ticket: any) {
  const user = ticket.user && typeof ticket.user === 'object' ? ticket.user : null;
  return {
    ...ticket,
    id: String(ticket._id || ticket.id),
    _id: undefined,
    user_id: user?._id ? String(user._id) : ticket.user ? String(ticket.user) : null,
    users: user ? { id: String(user._id), email: user.email, name: user.name, phone: user.phone } : null,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    replies: (ticket.replies || []).map((reply: any) => ({
      ...reply,
      id: String(reply._id || reply.id),
      _id: undefined,
      is_admin_reply: Boolean(reply.isAdminReply),
      created_at: reply.createdAt,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);
    const skip = (page - 1) * limit;

    await dbConnect();
    const [tickets, total] = await Promise.all([
      SupportTicket.find({}).populate('user', 'email name phone').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments({}),
    ]);

    return NextResponse.json({ success: true, data: tickets.map(formatTicket), pagination: { page, limit, total } });
  } catch (err: any) {
    console.error('/api/admin/support-tickets error', err);
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    if (!body.id) return NextResponse.json({ success: false, error: 'Missing ticket id' }, { status: 400 });

    await dbConnect();
    const previousTicket = await SupportTicket.findById(body.id).select('status').lean();
    const ticket = await SupportTicket.findByIdAndUpdate(
      body.id,
      { $set: { status: (body.status || 'open').toLowerCase() } },
      { new: true, runValidators: true }
    ).populate('user', 'email name phone').lean();

    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    if (previousTicket && String(previousTicket.status || '').toLowerCase() !== String(body.status || 'open').toLowerCase()) {
      await sendSupportTicketStatusUpdateEmail(ticket);
    }
    return NextResponse.json({ success: true, data: formatTicket(ticket) });
  } catch (err: any) {
    console.error('/api/admin/support-tickets PATCH error', err);
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
