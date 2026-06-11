import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product';
import User from '../../../../models/User';
import Warranty from '../../../../models/Warranty';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

const STATUSES = ['open', 'in_review', 'approved', 'rejected', 'closed'];

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function splitPhotos(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 8);
  return cleanString(value).split(/[|,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function formatWarranty(warranty: any) {
  const raw = typeof warranty?.toObject === 'function' ? warranty.toObject() : warranty;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const product = raw.product && typeof raw.product === 'object' ? raw.product : null;
  const order = raw.order && typeof raw.order === 'object' ? raw.order : null;
  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    user: user ? { id: String(user._id || user.id || ''), name: user.name || null, email: user.email || null } : raw.user || null,
    product: product
      ? { id: String(product._id || product.id || ''), name: product.name || product.title || null, slug: product.slug || null }
      : raw.product || null,
    order: order ? { id: String(order._id || order.id || ''), orderNumber: order.orderNumber || order._id || null } : raw.order || null,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function buildPayload(input: unknown) {
  const body = asRecord(input);
  const status = cleanString(body.status).toLowerCase();
  const payload: Record<string, unknown> = {};
  if (body.userId !== undefined || body.user !== undefined) payload.user = cleanString(body.userId || body.user) || null;
  if (body.orderId !== undefined || body.order !== undefined) payload.order = cleanString(body.orderId || body.order) || null;
  if (body.productId !== undefined || body.product !== undefined) payload.product = cleanString(body.productId || body.product) || null;
  if (body.subject !== undefined) payload.subject = cleanString(body.subject);
  if (body.issue !== undefined || body.message !== undefined) payload.issue = cleanString(body.issue || body.message);
  if (STATUSES.includes(status)) payload.status = status;
  if (body.resolution !== undefined) payload.resolution = cleanString(body.resolution) || null;
  if (body.adminNote !== undefined || body.admin_note !== undefined) payload.adminNote = cleanString(body.adminNote || body.admin_note) || null;
  if (body.photos !== undefined) payload.photos = splitPhotos(body.photos);
  return payload;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const url = new URL(req.url);
    const status = cleanString(url.searchParams.get('status')).toLowerCase();
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '50'), 1), 200);
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (STATUSES.includes(status)) query.status = status;

    const [items, total] = await Promise.all([
      Warranty.find(query)
        .populate({ path: 'user', select: 'name email', model: User })
        .populate({ path: 'product', select: 'name title slug image images', model: Product })
        .populate({ path: 'order', select: 'orderNumber totalAmount paymentStatus fulfillmentStatus', model: Order })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Warranty.countDocuments(query),
    ]);

    const data = items.map(formatWarranty);
    return NextResponse.json({ success: true, data, warranties: data, pagination: { page, limit, total } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load warranties';
    console.error('/api/admin/warranties GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const payload = buildPayload(await req.json());
    if (!payload.subject) return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
    if (!payload.issue) return NextResponse.json({ success: false, error: 'Issue description is required' }, { status: 400 });

    const warranty = await Warranty.create(payload);
    return NextResponse.json({ success: true, data: formatWarranty(warranty), warranty: formatWarranty(warranty) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create warranty';
    console.error('/api/admin/warranties POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
