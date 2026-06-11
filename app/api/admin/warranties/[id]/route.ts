import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Order from '../../../../../models/Order';
import Product from '../../../../../models/Product';
import User from '../../../../../models/User';
import Warranty from '../../../../../models/Warranty';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

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

function buildPayload(input: unknown) {
  const body = asRecord(input);
  const status = cleanString(body.status).toLowerCase();
  const payload: Record<string, unknown> = {};
  if (body.subject !== undefined) payload.subject = cleanString(body.subject);
  if (body.issue !== undefined || body.message !== undefined) payload.issue = cleanString(body.issue || body.message);
  if (STATUSES.includes(status)) payload.status = status;
  if (body.resolution !== undefined) payload.resolution = cleanString(body.resolution) || null;
  if (body.adminNote !== undefined || body.admin_note !== undefined) payload.adminNote = cleanString(body.adminNote || body.admin_note) || null;
  if (body.photos !== undefined) payload.photos = splitPhotos(body.photos);
  return payload;
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

function populateWarranty(query: any) {
  return query
    .populate({ path: 'user', select: 'name email', model: User })
    .populate({ path: 'product', select: 'name title slug image images', model: Product })
    .populate({ path: 'order', select: 'orderNumber totalAmount paymentStatus fulfillmentStatus', model: Order });
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    await dbConnect();
    const warranty = await populateWarranty(Warranty.findById(id)).lean();
    if (!warranty) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: formatWarranty(warranty), warranty: formatWarranty(warranty) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load warranty';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    await dbConnect();
    const warranty = await Warranty.findByIdAndUpdate(id, { $set: buildPayload(await req.json()) }, { new: true, runValidators: true });
    if (!warranty) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    const populated = await populateWarranty(Warranty.findById(warranty._id)).lean();
    return NextResponse.json({ success: true, data: formatWarranty(populated), warranty: formatWarranty(populated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update warranty';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    await dbConnect();
    const url = new URL(req.url);
    const hard = ['1', 'true', 'yes'].includes(cleanString(url.searchParams.get('hard')).toLowerCase());
    const warranty = hard
      ? await Warranty.findByIdAndDelete(id)
      : await Warranty.findByIdAndUpdate(id, { $set: { status: 'closed' } }, { new: true });
    if (!warranty) return NextResponse.json({ success: false, error: 'Warranty not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: hard ? null : formatWarranty(warranty) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete warranty';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
