import { NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import SupportTicket from '../../../../../../models/SupportTicket';
import { getUserFromRequest } from '../../../../../../lib/auth';
import { sendSupportTicketReplyNotificationEmail } from '../../../../../../lib/email';

function formatTicket(ticket: any) {
  return {
    ...ticket,
    id: String(ticket._id || ticket.id),
    _id: undefined,
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
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    const { message } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 });

    await dbConnect();
    const ticket = await SupportTicket.findOne({ _id: id, $or: [{ user: user.id }, { email: user.email }] });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    ticket.replies.push({ message: message.trim(), isAdminReply: false, user: user.id });
    await ticket.save();
    const ticketPayload = {
      ...ticket.toObject(),
      users: {
        name: user.name || '',
        email: user.email || '',
      },
    };
    await sendSupportTicketReplyNotificationEmail(ticketPayload, message.trim());
    return NextResponse.json({ success: true, data: formatTicket(ticketPayload) });
  } catch (error: any) {
    console.error('/api/me/tickets/[id]/replies POST error', error);
    return NextResponse.json({ error: error?.message || 'Failed to add reply' }, { status: 500 });
  }
}
