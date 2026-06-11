import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Branch from '../../../../models/Branch';
import User from '../../../../models/User';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

type JsonObject = Record<string, unknown>;

type BranchPayload = {
  name: string;
  slug?: string;
  code?: string | null;
  isActive: boolean;
  manager?: string | null;
  phone?: string | null;
  email?: string | null;
  workloadScore: number;
  deliveryRadiusKm?: number | null;
  notes?: string | null;
  address: {
    line1: string;
    city: string;
    state: string;
    country: string;
    zip: string;
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

function buildBranchPayload(body: unknown): BranchPayload {
  const input = asRecord(body);
  const name = cleanString(input.name);

  if (!name) {
    throw new Error('Branch name is required');
  }

  const deliveryRadiusSource = input.deliveryRadiusKm ?? input.delivery_radius_km;

  const payload: BranchPayload = {
    name,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    manager: resolveId(input.managerId || input.manager || input.manager_id) || null,
    code: cleanString(input.code) || null,
    phone: cleanString(input.phone) || null,
    email: cleanString(input.email) || null,
    workloadScore: Number(input.workloadScore ?? input.workload_score ?? 0) || 0,
    deliveryRadiusKm:
      deliveryRadiusSource !== undefined && deliveryRadiusSource !== ''
        ? Number(deliveryRadiusSource)
        : null,
    notes: cleanString(input.notes) || null,
    address: {
      line1: cleanString((input.address && asRecord(input.address).line1) || input.line1 || input.street) || '',
      city: cleanString((input.address && asRecord(input.address).city) || input.city) || '',
      state: cleanString((input.address && asRecord(input.address).state) || input.state) || '',
      country: cleanString((input.address && asRecord(input.address).country) || input.country) || 'Nigeria',
      zip: cleanString((input.address && asRecord(input.address).zip) || input.zip) || '',
      latitude: parseCoordinate((input.address && asRecord(input.address).latitude) || input.latitude || input.lat),
      longitude: parseCoordinate((input.address && asRecord(input.address).longitude) || input.longitude || input.lng || input.lon),
    },
  };

  if (input.slug !== undefined) {
    payload.slug = cleanString(input.slug) || slugify(name);
  }

  return payload;
}

export async function GET(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const branchQuery = scope.branchScoped && scope.branchId ? { _id: scope.branchId } : {};

    const branches = await Branch.find(branchQuery)
      .populate('manager', 'name email role')
      .sort({ isActive: -1, createdAt: -1 })
      .lean();

    const formattedBranches = branches.map(formatBranch);

    return NextResponse.json(
      {
        success: true,
        branches: formattedBranches,
        data: formattedBranches,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch branches';
    console.error('/api/admin/branches GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    await dbConnect();

    const payload = buildBranchPayload(body);
    if (!payload.slug) {
      payload.slug = slugify(payload.name);
    }

    if (payload.manager) {
      const managerExists = await User.findById(payload.manager).select('_id').lean();
      if (!managerExists) {
        return NextResponse.json({ success: false, error: 'Manager user not found' }, { status: 404 });
      }
    }

    const branch = await Branch.create(payload);
    return NextResponse.json({ success: true, branch: formatBranch(branch) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create branch';
    console.error('/api/admin/branches POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
