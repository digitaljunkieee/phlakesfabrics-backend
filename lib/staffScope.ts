import { isAdminRole, isStaffRole, normalizeRole } from './roles';

type ScopedUser = {
  id?: string;
  role?: unknown;
  branch?: unknown;
};

export type StaffScope = {
  role: ReturnType<typeof normalizeRole>;
  branchScoped: boolean;
  branchId: string | null;
  hasBranchAccess: boolean;
};

function cleanId(value: unknown) {
  return String(value ?? '').trim();
}

export function isBranchScopedRole(role: unknown) {
  const normalized = normalizeRole(role);
  return isStaffRole(normalized) && !isAdminRole(normalized);
}

export async function resolveStaffBranchId(user?: ScopedUser | null) {
  const role = normalizeRole(user?.role);
  if (!isBranchScopedRole(role)) {
    return null;
  }

  const directBranchId = cleanId(user?.branch);
  if (directBranchId) {
    return directBranchId;
  }

  if (role === 'branch_manager' && user?.id) {
    const [{ default: dbConnect }, { default: Branch }] = await Promise.all([
      import('./mongodb'),
      import('../models/Branch'),
    ]);
    await dbConnect();
    const branch = await Branch.findOne({ manager: user.id }).select('_id').lean();
    if (branch) {
      return String((branch as { _id?: unknown })._id || '');
    }
  }

  return null;
}

export async function resolveStaffScope(user?: ScopedUser | null): Promise<StaffScope> {
  const role = normalizeRole(user?.role);
  const branchScoped = isBranchScopedRole(role);
  const branchId = branchScoped ? await resolveStaffBranchId(user) : null;

  return {
    role,
    branchScoped,
    branchId,
    hasBranchAccess: !branchScoped || Boolean(branchId),
  };
}

export function buildBranchMatch<T extends string>(field: T, branchId: string | null) {
  if (!branchId) return null;
  return { [field]: branchId } as Record<T, string>;
}
