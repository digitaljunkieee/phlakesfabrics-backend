import { getAvailableInventoryQuantity, getDistanceKm, selectFulfillmentBranch } from '../../lib/branchFulfillment';

describe('branchFulfillment', () => {
  test('returns the preferred branch when it can fulfill the order', () => {
    const branch = selectFulfillmentBranch({
      preferredBranchId: 'branch-1',
      customerState: 'Imo',
      customerCity: 'lagos',
      items: [{ productId: 'product-1', quantity: 2 }],
      branches: [
        { id: 'branch-1', name: 'lagos Central', isActive: true, address: { state: 'Imo', city: 'lagos' } },
        { id: 'branch-2', name: 'Umuahia Branch', isActive: true, address: { state: 'Abia', city: 'Umuahia' } },
      ],
      inventoryRecords: [
        { branchId: 'branch-1', productId: 'product-1', quantity: 10, reservedQuantity: 1 },
        { branchId: 'branch-2', productId: 'product-1', quantity: 10, reservedQuantity: 0 },
      ],
    });

    expect(branch?.id).toBe('branch-1');
  });

  test('falls back to the branch that matches the customer state', () => {
    const branch = selectFulfillmentBranch({
      customerState: 'Imo',
      customerCity: 'lagos',
      items: [{ productId: 'product-1', quantity: 1 }],
      branches: [
        { id: 'branch-1', name: 'Lagos Hub', isActive: true, address: { state: 'Lagos', city: 'Ikeja' } },
        { id: 'branch-2', name: 'lagos Hub', isActive: true, address: { state: 'Imo', city: 'lagos' } },
      ],
      inventoryRecords: [
        { branchId: 'branch-1', productId: 'product-1', quantity: 5, reservedQuantity: 0 },
        { branchId: 'branch-2', productId: 'product-1', quantity: 5, reservedQuantity: 0 },
      ],
    });

    expect(branch?.id).toBe('branch-2');
  });

  test('selects the nearest branch when customer and branch coordinates are available', () => {
    const branch = selectFulfillmentBranch({
      customerState: 'Lagos',
      customerCity: 'Ikeja',
      customerLatitude: 6.6018,
      customerLongitude: 3.3515,
      items: [{ productId: 'product-1', quantity: 1 }],
      branches: [
        {
          id: 'branch-1',
          name: 'lagos Hub',
          isActive: true,
          address: { state: 'Imo', city: 'lagos', latitude: 5.4763, longitude: 7.0259 },
        },
        {
          id: 'branch-2',
          name: 'Lagos Showroom',
          isActive: true,
          address: { state: 'Lagos', city: 'Ikeja', latitude: 6.6043, longitude: 3.3491 },
        },
      ],
      inventoryRecords: [
        { branchId: 'branch-1', productId: 'product-1', quantity: 10, reservedQuantity: 0 },
        { branchId: 'branch-2', productId: 'product-1', quantity: 10, reservedQuantity: 0 },
      ],
    });

    expect(branch?.id).toBe('branch-2');
  });

  test('prefers a branch inside delivery radius over a closer out-of-radius branch', () => {
    const branch = selectFulfillmentBranch({
      customerLatitude: 6.6018,
      customerLongitude: 3.3515,
      items: [{ productId: 'product-1', quantity: 1 }],
      branches: [
        {
          id: 'branch-1',
          name: 'Tiny Radius Branch',
          isActive: true,
          deliveryRadiusKm: 0.1,
          address: { state: 'Lagos', city: 'Ikeja', latitude: 6.6043, longitude: 3.3491 },
        },
        {
          id: 'branch-2',
          name: 'Coverage Branch',
          isActive: true,
          deliveryRadiusKm: 10,
          address: { state: 'Lagos', city: 'Ikeja', latitude: 6.62, longitude: 3.36 },
        },
      ],
      inventoryRecords: [
        { branchId: 'branch-1', productId: 'product-1', quantity: 10, reservedQuantity: 0 },
        { branchId: 'branch-2', productId: 'product-1', quantity: 10, reservedQuantity: 0 },
      ],
    });

    expect(branch?.id).toBe('branch-2');
  });

  test('returns null when no branch can fully satisfy the order', () => {
    const branch = selectFulfillmentBranch({
      customerState: 'Imo',
      items: [{ productId: 'product-1', quantity: 4 }],
      branches: [{ id: 'branch-1', name: 'Only Branch', isActive: true, address: { state: 'Imo', city: 'lagos' } }],
      inventoryRecords: [{ branchId: 'branch-1', productId: 'product-1', quantity: 2, reservedQuantity: 0 }],
    });

    expect(branch).toBeNull();
  });

  test('exposes available quantity helper for UI/reporting use', () => {
    expect(getAvailableInventoryQuantity({ branchId: 'b', productId: 'p', quantity: 10, reservedQuantity: 3 })).toBe(7);
  });

  test('calculates distance between coordinates in kilometers', () => {
    const distance = getDistanceKm(
      { latitude: 6.6018, longitude: 3.3515 },
      { latitude: 6.6043, longitude: 3.3491 }
    );

    expect(distance).not.toBeNull();
    expect(distance as number).toBeLessThan(1);
  });
});
