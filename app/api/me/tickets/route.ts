import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';
import dbConnect from '../../../../lib/mongodb';
import SupportTicket from '../../../../models/SupportTicket';
import {
  sendSupportTicketNotificationEmail,
  sendSupportTicketReceivedEmail,
} from '../../../../lib/email';

function formatTicket(ticket: any) {
  return {
    ...ticket,
    id: String(ticket._id || ticket.id),
    _id: undefined,
    user_id: ticket.user ? String(ticket.user) : null,
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
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 500);
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);

    await dbConnect();
    const query = { $or: [{ user: user.id }, { email: user.email }] };
    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      SupportTicket.countDocuments(query),
    ]);

    const data = tickets.map(formatTicket);
    return NextResponse.json({ items: data, data, total });
  } catch (err: any) {
    console.error('/api/me/tickets error', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.subject || !body.message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    await dbConnect();
    const created = await SupportTicket.create({
      user: user.id,
      email: user.email,
      subject: body.subject,
      priority: body.priority || 'low',
      message: body.message,
      status: 'open',
    });

    const createdTicket = {
      ...created.toObject(),
      users: {
        name: user.name || '',
        email: user.email || '',
      },
    };

    await Promise.allSettled([
      sendSupportTicketReceivedEmail(createdTicket),
      sendSupportTicketNotificationEmail(createdTicket),
    ]);

    return NextResponse.json({ success: true, data: formatTicket(createdTicket) }, { status: 201 });
  } catch (err: any) {
    console.error('/api/me/tickets POST error', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
