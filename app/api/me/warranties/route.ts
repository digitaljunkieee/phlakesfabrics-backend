import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getUserFromRequest } from '../../../../lib/auth';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product';
import Warranty from '../../../../models/Warranty';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function splitPhotos(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 8);
  return cleanString(value).split(/[|,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function formatWarranty(warranty: any) {
  const raw = typeof warranty?.toObject === 'function' ? warranty.toObject() : warranty;
  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await dbConnect();
    const warranties = await Warranty.find({ user: user.id })
      .populate({ path: 'product', select: 'name title slug image images', model: Product })
      .populate({ path: 'order', select: 'orderNumber totalAmount paymentStatus fulfillmentStatus', model: Order })
      .sort({ createdAt: -1 })
      .lean();
    const data = warranties.map(formatWarranty);
    return NextResponse.json({ success: true, data, warranties: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load warranties';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await dbConnect();
    const body = await req.json();
    const subject = cleanString(body.subject || body.title || 'Warranty request');
    const issue = cleanString(body.issue || body.message || body.description);
    if (!issue) return NextResponse.json({ success: false, error: 'Issue description is required' }, { status: 400 });

    const warranty = await Warranty.create({
      user: user.id,
      order: cleanString(body.orderId || body.order) || null,
      product: cleanString(body.productId || body.product) || null,
      subject,
      issue,
      photos: splitPhotos(body.photos),
      status: 'open',
    });

    return NextResponse.json({ success: true, data: formatWarranty(warranty), warranty: formatWarranty(warranty) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create warranty';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
