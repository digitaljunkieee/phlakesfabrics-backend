export const APP_ROLES = [
  'customer',
  'admin',
  'super_admin',
  'branch_manager',
  'sales_staff',
  'delivery',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin'];
export const STAFF_ROLES: AppRole[] = ['branch_manager', 'sales_staff', 'delivery'];
export const BRANCH_OPERATIONS_ROLES: AppRole[] = ['super_admin', 'admin', 'branch_manager', 'sales_staff'];
export const DELIVERY_ROLES: AppRole[] = ['super_admin', 'admin', 'delivery'];

export function normalizeRole(role: unknown): AppRole {
  const normalized = String(role ?? '')
    .trim()
    .toLowerCase() as AppRole;

  return APP_ROLES.includes(normalized) ? normalized : 'customer';
}

export function hasAnyRole(role: unknown, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(normalizeRole(role));
}

export function isAdminRole(role: unknown) {
  return ADMIN_ROLES.includes(normalizeRole(role));
}

export function isStaffRole(role: unknown) {
  return STAFF_ROLES.includes(normalizeRole(role));
}

export function getRoleHomePath(role: unknown) {
  const normalized = normalizeRole(role);
  if (ADMIN_ROLES.includes(normalized)) return '/admin';
  if (['branch_manager', 'sales_staff', 'delivery'].includes(normalized)) return '/staff';
  return '/dashboard';
}
