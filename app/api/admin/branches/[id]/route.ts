import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Branch from '../../../../../models/Branch';
import User from '../../../../../models/User';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

type JsonObject = Record<string, unknown>;

type BranchUpdatePayload = {
  name?: string;
  slug?: string;
  code?: string | null;
  isActive?: boolean;
  manager?: string | null;
  phone?: string | null;
  email?: string | null;
  workloadScore?: number;
  deliveryRadiusKm?: number | null;
  notes?: string | null;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
};

function asRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' ? (value as JsonObject) : {};
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function parseCoordinate(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function resolveId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') {
    const record = asRecord(value);
    return cleanString(record.id || record._id || record.branchId || record.managerId);
  }
  return cleanString(value);
}

function slugify(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function formatBranch(branch: unknown) {
  const candidate = branch as { toObject?: () => unknown };
  const raw = typeof candidate?.toObject === 'function' ? asRecord(candidate.toObject()) : asRecord(branch);
  const managerRecord = asRecord(raw.manager);
  const addressRecord = asRecord(raw.address);

  const manager =
    Object.keys(managerRecord).length > 0
      ? {
          id: String(managerRecord._id || managerRecord.id || ''),
          name: (managerRecord.name as string | null | undefined) || null,
          email: (managerRecord.email as string | null | undefined) || null,
          role: (managerRecord.role as string | null | undefined) || null,
        }
      : raw.manager || null;

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    manager,
    address: {
      line1: cleanString(addressRecord.line1),
      city: cleanString(addressRecord.city),
      state: cleanString(addressRecord.state),
      country: cleanString(addressRecord.country) || 'Nigeria',
      zip: cleanString(addressRecord.zip),
      latitude: parseCoordinate(addressRecord.latitude),
      longitude: parseCoordinate(addressRecord.longitude),
    },
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function buildBranchPayload(body: unknown): BranchUpdatePayload {
  const input = asRecord(body);
  const payload: BranchUpdatePayload = {};

  if (input.name !== undefined) payload.name = cleanString(input.name);
  if (input.slug !== undefined) payload.slug = cleanString(input.slug) || (payload.name ? slugify(payload.name) : undefined);
  if (input.code !== undefined) payload.code = cleanString(input.code) || null;
  if (input.isActive !== undefined) payload.isActive = Boolean(input.isActive);
  if (input.managerId !== undefined || input.manager !== undefined || input.manager_id !== undefined) {
    payload.manager = resolveId(input.managerId || input.manager || input.manager_id) || null;
  }
  if (input.phone !== undefined) payload.phone = cleanString(input.phone) || null;
  if (input.email !== undefined) payload.email = cleanString(input.email) || null;
  if (input.workloadScore !== undefined || input.workload_score !== undefined) {
    payload.workloadScore = Number(input.workloadScore ?? input.workload_score ?? 0) || 0;
  }
  if (input.deliveryRadiusKm !== undefined || input.delivery_radius_km !== undefined) {
    const deliveryRadiusSource = input.deliveryRadiusKm ?? input.delivery_radius_km;
    payload.deliveryRadiusKm =
      deliveryRadiusSource !== undefined && deliveryRadiusSource !== '' ? Number(deliveryRadiusSource) : null;
  }
  if (input.notes !== undefined) payload.notes = cleanString(input.notes) || null;
  if (
    input.address ||
    input.line1 !== undefined ||
    input.city !== undefined ||
    input.state !== undefined ||
    input.country !== undefined ||
    input.zip !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined ||
    input.lat !== undefined ||
    input.lng !== undefined ||
    input.lon !== undefined
  ) {
    const address = asRecord(input.address);
    payload.address = {
      line1: cleanString(address.line1 ?? input.line1 ?? input.street) || '',
      city: cleanString(address.city ?? input.city) || '',
      state: cleanString(address.state ?? input.state) || '',
      country: cleanString(address.country ?? input.country) || 'Nigeria',
      zip: cleanString(address.zip ?? input.zip) || '',
      latitude: parseCoordinate(address.latitude ?? input.latitude ?? input.lat),
      longitude: parseCoordinate(address.longitude ?? input.longitude ?? input.lng ?? input.lon),
    };
  }

  return payload;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    await dbConnect();
    const branch = await Branch.findById(id).populate('manager', 'name email role').lean();
    if (!branch) return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ success: true, branch: formatBranch(branch) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch branch';
    console.error('/api/admin/branches/[id] GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    await dbConnect();

    const payload = buildBranchPayload(body);
    if (payload.name && !payload.slug) {
      payload.slug = slugify(payload.name);
    }

    if (payload.manager) {
      const managerExists = await User.findById(payload.manager).select('_id').lean();
      if (!managerExists) {
        return NextResponse.json({ success: false, error: 'Manager user not found' }, { status: 404 });
      }
    }

    const branch = await Branch.findByIdAndUpdate(id, { $set: payload }, { returnDocument: 'after', runValidators: true })
      .populate('manager', 'name email role')
      .lean();

    if (!branch) return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ success: true, branch: formatBranch(branch) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update branch';
    console.error('/api/admin/branches/[id] PATCH error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    await dbConnect();
    const branch = await Branch.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('manager', 'name email role')
      .lean();

    if (!branch) return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ success: true, branch: formatBranch(branch) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate branch';
    console.error('/api/admin/branches/[id] DELETE error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
