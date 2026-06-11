import { buildBranchMatch, isBranchScopedRole } from '../../lib/staffScope';

describe('staffScope', () => {
  it('detects branch-scoped staff roles', () => {
    expect(isBranchScopedRole('branch_manager')).toBe(true);
    expect(isBranchScopedRole('sales_staff')).toBe(true);
    expect(isBranchScopedRole('delivery')).toBe(true);
    expect(isBranchScopedRole('admin')).toBe(false);
    expect(isBranchScopedRole('super_admin')).toBe(false);
  });

  it('builds a branch filter only when a branch id exists', () => {
    expect(buildBranchMatch('branch', 'branch-123')).toEqual({ branch: 'branch-123' });
    expect(buildBranchMatch('branch', null)).toBeNull();
  });
});
