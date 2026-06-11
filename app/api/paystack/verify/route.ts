import { NextResponse, NextRequest } from 'next/server';
import axios from 'axios';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import corsHeaders from '../../../../lib/cors';

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const headers = { ...corsHeaders(origin, true), 'Content-Type': 'application/json' };

  try {
    const searchParams = new URL(req.url).searchParams;
    const incomingReference = searchParams.get('reference') || searchParams.get('trxref');
    if (!incomingReference) {
      return NextResponse.json({ success: false, error: 'Missing reference or trxref query parameter' }, { status: 400, headers });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'PAYSTACK_SECRET_KEY not configured' }, { status: 500, headers });
    }

    await dbConnect();

    const localOrderQuery: any[] = [{ paystackReference: incomingReference }];
    if (mongoose.Types.ObjectId.isValid(incomingReference)) {
      localOrderQuery.push({ _id: incomingReference });
    }

    const order = await Order.findOne({ $or: localOrderQuery });
    const referenceToVerify = order?.paystackReference || incomingReference;

    const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(referenceToVerify)}`, {
      headers: { Authorization: `Bearer ${String(secret).trim()}` },
    });

    const verified = verifyRes.data;
    const paymentSuccess = verified?.status === true && verified?.data?.status === 'success';
    if (!paymentSuccess) {
      return NextResponse.json({ success: false, status: verified?.data?.status ?? verified?.status, data: verified?.data }, { headers });
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'No local order found for payment reference' }, { status: 404, headers });
    }

    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paystackReference = referenceToVerify;
      if (['pending', 'unfulfilled'].includes(String(order.fulfillmentStatus || '').toLowerCase())) {
        order.fulfillmentStatus = 'confirmed';
      }
      await order.save();
    }

    return NextResponse.json({ success: true, orderId: order._id.toString() }, { headers });
  } catch (err: any) {
    console.error('Paystack verify unexpected error:', err?.response?.data || err);
    return NextResponse.json({ success: false, error: err?.response?.data?.message || err?.message || 'Verification failed' }, { status: 500, headers });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin') ?? '', true) });
}
