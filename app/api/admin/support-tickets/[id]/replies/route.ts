import { NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import SupportTicket from '../../../../../../models/SupportTicket';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { sendSupportReplyEmail } from '../../../../../../lib/email';

function formatTicket(ticket: any) {
  const user = ticket.user && typeof ticket.user === 'object' ? ticket.user : null;
  return {
    ...ticket,
    id: String(ticket._id || ticket.id),
    _id: undefined,
    user_id: user?._id ? String(user._id) : ticket.user ? String(ticket.user) : null,
    users: user ? { id: String(user._id), email: user.email, name: user.name, phone: user.phone } : null,
    replies: (ticket.replies || []).map((reply: any) => ({
      ...reply,
      id: String(reply._id || reply.id),
      _id: undefined,
      is_admin_reply: Boolean(reply.isAdminReply),
      created_at: reply.createdAt,
    })),
  };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, 'admin');
  if (!auth.authorized) return auth.response;
  const adminUser = (auth as any).user;

  try {
    const { id } = await context.params;
    const { message } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 });

    await dbConnect();
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    ticket.replies.push({ message: message.trim(), isAdminReply: true, user: adminUser.id });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();

    await sendSupportReplyEmail(ticket.toObject(), message.trim());
    const refreshedTicket = await SupportTicket.findById(id).populate('user', 'email name phone').lean();
    return NextResponse.json({ success: true, data: formatTicket(refreshedTicket || ticket.toObject()) });
  } catch (error: any) {
    console.error('/api/admin/support-tickets/[id]/replies POST error', error);
    return NextResponse.json({ error: error?.message || 'Failed to add reply' }, { status: 500 });
  }
}
