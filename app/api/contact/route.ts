import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import SupportTicket from '../../../models/SupportTicket';
import { sendContactFormEmail, sendContactSubmissionConfirmationEmail } from '../../../lib/email';

function clean(value: any) {
  return String(value || '').trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const subject = clean(body.subject) || 'General inquiry';
    const message = clean(body.message);

    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json({ success: false, error: 'Missing required contact fields' }, { status: 400 });
    }

    await dbConnect();

    const ticket = await SupportTicket.create({
      user: null,
      email,
      subject: `[Contact] ${subject}`,
      priority: 'low',
      message: `Name: ${firstName} ${lastName}\nPhone: ${phone || 'N/A'}\n\n${message}`,
      status: 'open',
    });

    await Promise.allSettled([
      sendContactFormEmail({
        firstName,
        lastName,
        email,
        phone,
        subject,
        message,
      }),
      sendContactSubmissionConfirmationEmail({
        email,
        name: `${firstName} ${lastName}`.trim(),
        subject,
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully.',
      data: {
        id: String(ticket._id),
        subject: ticket.subject,
      },
    });
  } catch (error: any) {
    console.error('/api/contact POST error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to submit contact form' }, { status: 500 });
  }
}
