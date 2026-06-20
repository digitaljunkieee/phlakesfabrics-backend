import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Branch from '../../../../../models/Branch';
import ShippingMethod from '../../../../../models/ShippingMethod';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function slugify(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function buildPayload(input: unknown) {
  const body = asRecord(input);
  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = cleanString(body.name);
  if (body.code !== undefined) payload.code = slugify(body.code);
  if (body.description !== undefined) payload.description = cleanString(body.description) || null;
  if (body.type !== undefined) payload.type = cleanString(body.type).toLowerCase() || 'delivery';
  if (body.baseFee !== undefined || body.base_fee !== undefined) payload.baseFee = Number(body.baseFee ?? body.base_fee ?? 0) || 0;
  if (body.freeShippingThreshold !== undefined || body.free_shipping_threshold !== undefined) {
    const value = body.freeShippingThreshold ?? body.free_shipping_threshold;
    payload.freeShippingThreshold = value === '' || value === null ? null : Number(value) || 0;
  }
  if (body.estimatedDaysMin !== undefined || body.estimated_days_min !== undefined) {
    const value = body.estimatedDaysMin ?? body.estimated_days_min;
    payload.estimatedDaysMin = value === '' || value === null ? null : Number(value) || 0;
  }
  if (body.estimatedDaysMax !== undefined || body.estimated_days_max !== undefined) {
    const value = body.estimatedDaysMax ?? body.estimated_days_max;
    payload.estimatedDaysMax = value === '' || value === null ? null : Number(value) || 0;
  }
  if (body.branchId !== undefined || body.branch !== undefined) payload.branch = cleanString(body.branchId || body.branch) || null;
  if (body.isActive !== undefined || body.is_active !== undefined) payload.isActive = Boolean(body.isActive ?? body.is_active);
  if (body.sortOrder !== undefined || body.sort_order !== undefined) payload.sortOrder = Number(body.sortOrder ?? body.sort_order ?? 0) || 0;
  return payload;
}

function formatMethod(method: any) {
  const raw = typeof method?.toObject === 'function' ? method.toObject() : method;
  const branch = raw.branch && typeof raw.branch === 'object' ? raw.branch : null;
  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    branch: branch
      ? {
          id: String(branch._id || branch.id || ''),
          name: branch.name || null,
          code: branch.code || null,
          slug: branch.slug || null,
        }
      : raw.branch || null,
    base_fee: Number(raw.baseFee || 0),
    free_shipping_threshold: raw.freeShippingThreshold ?? null,
    estimated_days_min: raw.estimatedDaysMin ?? null,
    estimated_days_max: raw.estimatedDaysMax ?? null,
    is_active: raw.isActive !== false,
    sort_order: Number(raw.sortOrder || 0),
  };
}

async function getMethod(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return ShippingMethod.findById(id).populate({ path: 'branch', select: 'name slug code', model: Branch });
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const { id } = await context.params;
    const method = await getMethod(id);
    if (!method) return NextResponse.json({ success: false, error: 'Shipping method not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: formatMethod(method), method: formatMethod(method) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load shipping method';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const { id } = await context.params;
    const payload = buildPayload(await req.json());
    const method = await ShippingMethod.findByIdAndUpdate(id, { $set: payload }, { returnDocument: 'after', runValidators: true })
      .populate({ path: 'branch', select: 'name slug code', model: Branch });
    if (!method) return NextResponse.json({ success: false, error: 'Shipping method not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: formatMethod(method), method: formatMethod(method) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update shipping method';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const { id } = await context.params;
    const url = new URL(req.url);
    const hard = ['1', 'true', 'yes'].includes(cleanString(url.searchParams.get('hard')).toLowerCase());
    const method = hard
      ? await ShippingMethod.findByIdAndDelete(id)
      : await ShippingMethod.findByIdAndUpdate(id, { $set: { isActive: false } }, { returnDocument: 'after' });
    if (!method) return NextResponse.json({ success: false, error: 'Shipping method not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: hard ? null : formatMethod(method) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete shipping method';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
