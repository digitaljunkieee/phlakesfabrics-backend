import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import SupportTicket from '../../../../../models/SupportTicket';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { sendSupportTicketStatusUpdateEmail } from '../../../../../lib/email';

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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    const { id } = await context.params;
    if (!id) return NextResponse.json({ success: false, error: 'Missing ticket id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || 'open').toLowerCase();

    await dbConnect();
    const previousTicket = await SupportTicket.findById(id).select('status').lean();
    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    ).populate('user', 'email name phone').lean();

    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    if (previousTicket && String(previousTicket.status || '').toLowerCase() !== status) {
      await sendSupportTicketStatusUpdateEmail(ticket);
    }
    return NextResponse.json({ success: true, data: formatTicket(ticket) });
  } catch (err: any) {
    console.error('/api/admin/support-tickets/[id] PATCH error', err);
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
