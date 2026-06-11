import { getRoleHomePath, hasAnyRole, normalizeRole } from '../../lib/roles';

describe('role helpers', () => {
  it('normalizes known roles and falls back to customer', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('branch_manager')).toBe('branch_manager');
    expect(normalizeRole('unknown-role')).toBe('customer');
  });

  it('maps roles to the correct home paths', () => {
    expect(getRoleHomePath('super_admin')).toBe('/admin');
    expect(getRoleHomePath('delivery')).toBe('/staff');
    expect(getRoleHomePath('customer')).toBe('/dashboard');
  });

  it('matches against allowed role lists', () => {
    expect(hasAnyRole('sales_staff', ['branch_manager', 'sales_staff'])).toBe(true);
    expect(hasAnyRole('delivery', ['admin', 'super_admin'])).toBe(false);
  });
});
