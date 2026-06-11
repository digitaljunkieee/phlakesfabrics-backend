import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import Branch from '../../../../models/Branch';
import Order from '../../../../models/Order';
import User from '../../../../models/User';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { APP_ROLES, normalizeRole } from '../../../../lib/roles';
import { resolveStaffScope } from '../../../../lib/staffScope';

type JsonRecord = Record<string, unknown>;

const STAFF_ROLES = ['branch_manager', 'sales_staff', 'delivery'];
const ADMIN_ONLY_ROLES = ['admin', 'super_admin'];
const BRANCH_MANAGER_STAFF_ROLES = ['sales_staff', 'delivery'];
const PRIVATE_FIELDS =
  '-password -refreshTokenHash -refreshTokenIssuedAt -refreshTokenExpiresAt -emailVerificationToken -passwordResetToken';

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function toObjectId(value: unknown) {
  const id = cleanString(value);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function canManageRole(currentRole: unknown, requestedRole: string) {
  if (!ADMIN_ONLY_ROLES.includes(requestedRole)) return true;
  return currentRole === 'super_admin';
}

function normalizeUser(rawUser: unknown, statsByUserId = new Map<string, JsonRecord>()) {
  const user = asRecord(rawUser);
  const branchRecord = asRecord(user.branch);
  const id = cleanString(user._id || user.id);
  const stats = asRecord(statsByUserId.get(id));

  return {
    id,
    name: cleanString(user.name) || null,
    email: cleanString(user.email),
    phone: cleanString(user.phone) || null,
    role: normalizeRole(user.role),
    status: cleanString(user.status) || (user.isActive === false ? 'suspended' : 'active'),
    isActive: user.isActive !== false && cleanString(user.status) !== 'suspended',
    emailVerified: user.emailVerified !== false,
    branch:
      Object.keys(branchRecord).length > 0
        ? {
            id: cleanString(branchRecord._id || branchRecord.id),
            name: cleanString(branchRecord.name) || null,
            code: cleanString(branchRecord.code) || null,
            slug: cleanString(branchRecord.slug) || null,
          }
        : null,
    branchId: Object.keys(branchRecord).length > 0 ? cleanString(branchRecord._id || branchRecord.id) : cleanString(user.branch) || null,
    address: user.address || null,
    disabledAt: user.disabledAt || null,
    disabledReason: cleanString(user.disabledReason) || null,
    joinedAt: user.createdAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    total_orders: Number(stats.total_orders || 0),
    total_spent: Number(stats.total_spent || 0),
    last_order_date: stats.last_order_date || null,
  };
}

async function getOrderStats(userIds: string[]) {
  const objectIds = userIds.map(toObjectId).filter(Boolean);
  if (!objectIds.length) return new Map<string, JsonRecord>();

  const stats = await Order.aggregate([
    { $match: { user: { $in: objectIds } } },
    {
      $group: {
        _id: '$user',
        total_orders: { $sum: 1 },
        total_spent: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'refunded']] }, { $ifNull: ['$totalAmount', 0] }, 0],
          },
        },
        last_order_date: { $max: '$createdAt' },
      },
    },
  ]);

  return new Map(stats.map((entry) => [String(entry._id), entry]));
}

async function validateBranch(branchId: string | null) {
  if (!branchId) return null;
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new Error('Invalid branch');
  }
  const branch = await Branch.findById(branchId).select('_id name').lean();
  if (!branch) throw new Error('Branch not found');
  return branch;
}

function buildAddress(input: JsonRecord) {
  const address = asRecord(input.address);
  const line1 = cleanString(input.addressLine1 ?? input.address ?? address.line1 ?? address.street);
  const city = cleanString(input.city ?? address.city);
  const state = cleanString(input.state ?? address.state);
  const country = cleanString(input.country ?? address.country) || 'Nigeria';
  const zip = cleanString(input.zip ?? input.postalCode ?? address.zip);

  if (!line1 && !city && !state && !zip) return undefined;
  return { line1, city, state, country, zip };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const currentRole = normalizeRole(auth.user?.role);
    const scope = await resolveStaffScope(auth.user);
    const branchManagerScoped = currentRole === 'branch_manager';
    if (branchManagerScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const role = cleanString(url.searchParams.get('role')).toLowerCase();
    const branchId = cleanString(url.searchParams.get('branchId') || url.searchParams.get('branch'));
    const search = cleanString(url.searchParams.get('search') || url.searchParams.get('q'));
    const status = cleanString(url.searchParams.get('status')).toLowerCase();
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);
    const skip = (page - 1) * limit;

    const query: JsonRecord = {};
    if (role && APP_ROLES.includes(role as (typeof APP_ROLES)[number])) query.role = role;
    if (branchId) query.branch = branchId;
    if (branchManagerScoped) {
      if (role && !BRANCH_MANAGER_STAFF_ROLES.includes(role)) {
        return NextResponse.json({ success: false, error: 'Branch managers can only manage sales and delivery staff' }, { status: 403 });
      }
      query.branch = scope.branchId;
      if (!role) query.role = { $in: BRANCH_MANAGER_STAFF_ROLES };
    }
    if (status === 'active') {
      query.isActive = { $ne: false };
      query.status = { $ne: 'suspended' };
    }
    if (status === 'suspended') {
      query.$or = [{ isActive: false }, { status: 'suspended' }];
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [
        ...((query.$and as unknown[]) || []),
        { $or: [{ name: regex }, { email: regex }, { phone: regex }, { role: regex }] },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(PRIVATE_FIELDS)
        .populate({ path: 'branch', select: 'name slug code', model: Branch })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const stats = await getOrderStats(users.map((user: JsonRecord) => cleanString(user._id || user.id)));
    const data = users.map((user: unknown) => normalizeUser(user, stats));

    return NextResponse.json({
      success: true,
      data,
      users: data,
      pagination: { page, limit, total },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    console.error('/api/admin/users GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const currentRole = normalizeRole(auth.user?.role);
    const scope = await resolveStaffScope(auth.user);
    const body = asRecord(await req.json());
    const name = cleanString(body.name);
    const email = cleanEmail(body.email);
    const phone = cleanString(body.phone);
    const role = normalizeRole(body.role || 'customer');
    let branchId = cleanString(body.branchId || body.branch);
    const password = cleanString(body.password);

    if (currentRole === 'branch_manager') {
      if (!scope.hasBranchAccess) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      if (!BRANCH_MANAGER_STAFF_ROLES.includes(role)) {
        return NextResponse.json({ success: false, error: 'Branch managers can only create sales and delivery staff' }, { status: 403 });
      }
      branchId = scope.branchId || '';
    }

    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    if (!email) return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (!canManageRole(auth.user?.role, role)) {
      return NextResponse.json({ success: false, error: 'Only super admins can manage admin accounts' }, { status: 403 });
    }
    if (STAFF_ROLES.includes(role) && !branchId) {
      return NextResponse.json({ success: false, error: 'Branch is required for staff roles' }, { status: 400 });
    }

    const existing = await User.findOne({ email }).select('_id').lean();
    if (existing) {
      return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 409 });
    }

    await validateBranch(branchId || null);

    const user = await User.create({
      name,
      email,
      phone,
      role,
      branch: branchId || null,
      password: await bcrypt.hash(password, 10),
      emailVerified: body.emailVerified === false ? false : true,
      isActive: body.isActive === false ? false : true,
      status: body.isActive === false ? 'suspended' : 'active',
      address: buildAddress(body),
    });

    if (role === 'branch_manager' && branchId) {
      await Branch.findByIdAndUpdate(branchId, { manager: user._id });
    }

    const populated = await User.findById(user._id)
      .select(PRIVATE_FIELDS)
      .populate({ path: 'branch', select: 'name slug code', model: Branch })
      .lean();

    return NextResponse.json({ success: true, data: normalizeUser(populated) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    console.error('/api/admin/users POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const currentAuthRole = normalizeRole(auth.user?.role);
    const scope = await resolveStaffScope(auth.user);
    const body = asRecord(await req.json());
    const id = cleanString(body.id || body.userId || body._id);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Valid user id is required' }, { status: 400 });
    }

    const user = await User.findById(id);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const currentRole = normalizeRole(user.role);
    const nextRole = body.role !== undefined ? normalizeRole(body.role) : currentRole;
    if (currentAuthRole === 'branch_manager') {
      if (!scope.hasBranchAccess) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      const userBranchId = cleanString(user.branch);
      if (userBranchId !== scope.branchId || !BRANCH_MANAGER_STAFF_ROLES.includes(currentRole)) {
        return NextResponse.json({ success: false, error: 'Branch managers can only manage staff in their branch' }, { status: 403 });
      }
      if (!BRANCH_MANAGER_STAFF_ROLES.includes(nextRole)) {
        return NextResponse.json({ success: false, error: 'Branch managers can only assign sales or delivery roles' }, { status: 403 });
      }
      body.branch = scope.branchId;
      body.branchId = scope.branchId;
    }
    if (!canManageRole(auth.user?.role, currentRole) || !canManageRole(auth.user?.role, nextRole)) {
      return NextResponse.json({ success: false, error: 'Only super admins can manage admin accounts' }, { status: 403 });
    }

    const nextBranchId =
      body.branchId !== undefined || body.branch !== undefined
        ? cleanString(body.branchId || body.branch) || null
        : user.branch
          ? String(user.branch)
          : null;

    if (STAFF_ROLES.includes(nextRole) && !nextBranchId) {
      return NextResponse.json({ success: false, error: 'Branch is required for staff roles' }, { status: 400 });
    }
    await validateBranch(nextBranchId);

    if (body.email !== undefined) {
      const email = cleanEmail(body.email);
      if (!email) return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
      const duplicate = await User.findOne({ email, _id: { $ne: id } }).select('_id').lean();
      if (duplicate) return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 409 });
      user.email = email;
    }

    if (body.name !== undefined) user.name = cleanString(body.name);
    if (body.phone !== undefined) user.phone = cleanString(body.phone);
    if (body.role !== undefined) user.role = nextRole;
    if (body.branchId !== undefined || body.branch !== undefined) user.branch = nextBranchId || null;
    if (body.emailVerified !== undefined) user.emailVerified = Boolean(body.emailVerified);

    if (body.password !== undefined && cleanString(body.password)) {
      const password = cleanString(body.password);
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      user.password = await bcrypt.hash(password, 10);
      user.refreshTokenHash = null;
      user.refreshTokenIssuedAt = null;
      user.refreshTokenExpiresAt = null;
    }

    if (body.isActive !== undefined || body.status !== undefined) {
      const active = body.status !== undefined ? cleanString(body.status).toLowerCase() !== 'suspended' : Boolean(body.isActive);
      const selfUpdate = cleanString(auth.user?.id) === id;
      if (!active && selfUpdate) {
        return NextResponse.json({ success: false, error: 'You cannot suspend your own account' }, { status: 400 });
      }
      user.isActive = active;
      user.status = active ? 'active' : 'suspended';
      user.disabledAt = active ? null : new Date();
      user.disabledReason = active ? null : cleanString(body.disabledReason || body.reason) || 'Suspended by administrator';
      if (!active) {
        user.refreshTokenHash = null;
        user.refreshTokenIssuedAt = null;
        user.refreshTokenExpiresAt = null;
      }
    }

    const address = buildAddress(body);
    if (address) user.address = address;

    await user.save();
    if (nextRole === 'branch_manager' && nextBranchId) {
      await Branch.findByIdAndUpdate(nextBranchId, { manager: user._id });
    }

    const populated = await User.findById(user._id)
      .select(PRIVATE_FIELDS)
      .populate({ path: 'branch', select: 'name slug code', model: Branch })
      .lean();

    return NextResponse.json({ success: true, data: normalizeUser(populated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    console.error('/api/admin/users PATCH error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const currentAuthRole = normalizeRole(auth.user?.role);
    const scope = await resolveStaffScope(auth.user);
    const url = new URL(req.url);
    const id = cleanString(url.searchParams.get('id') || url.searchParams.get('userId'));
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Valid user id is required' }, { status: 400 });
    }
    if (cleanString(auth.user?.id) === id) {
      return NextResponse.json({ success: false, error: 'You cannot suspend your own account' }, { status: 400 });
    }

    const user = await User.findById(id);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const currentRole = normalizeRole(user.role);
    if (currentAuthRole === 'branch_manager') {
      if (!scope.hasBranchAccess) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      if (cleanString(user.branch) !== scope.branchId || !BRANCH_MANAGER_STAFF_ROLES.includes(currentRole)) {
        return NextResponse.json({ success: false, error: 'Branch managers can only suspend staff in their branch' }, { status: 403 });
      }
    }
    if (!canManageRole(auth.user?.role, currentRole)) {
      return NextResponse.json({ success: false, error: 'Only super admins can manage admin accounts' }, { status: 403 });
    }

    user.isActive = false;
    user.status = 'suspended';
    user.disabledAt = new Date();
    user.disabledReason = cleanString(url.searchParams.get('reason')) || 'Suspended by administrator';
    user.refreshTokenHash = null;
    user.refreshTokenIssuedAt = null;
    user.refreshTokenExpiresAt = null;
    await user.save();

    return NextResponse.json({ success: true, data: normalizeUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to suspend user';
    console.error('/api/admin/users DELETE error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
