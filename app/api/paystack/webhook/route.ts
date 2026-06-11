import { NextResponse, NextRequest } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';
    const secret = String(process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^"|"$/g, '');

    if (!secret) {
      return NextResponse.json({ success: false, error: 'Webhook secret not configured' }, { status: 500 });
    }

    const hash = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    if (!signature || signature !== hash) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(raw);
    const data = payload.data || payload;
    const reference = data.reference || data.transaction || data.id || null;
    if (!reference) return NextResponse.json({ success: true });

    const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    if (verifyRes.data?.data?.status === 'success') {
      await dbConnect();
      const order = await Order.findOne({ $or: [{ _id: reference }, { paystackReference: reference }] });
      if (order) {
        order.paymentStatus = 'paid';
        order.paystackReference = reference;
        if (['pending', 'unfulfilled'].includes(String(order.fulfillmentStatus || '').toLowerCase())) {
          order.fulfillmentStatus = 'confirmed';
        }
        await order.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Paystack webhook error:', err?.response?.data || err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
