export type BranchSnapshot = {
  id: string;
  name: string;
  slug?: string | null;
  code?: string | null;
  isActive?: boolean;
  workloadScore?: number | null;
  address?: {
    city?: string | null;
    state?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
  deliveryRadiusKm?: number | null;
};

export type InventorySnapshot = {
  branchId: string;
  productId: string;
  quantity: number;
  reservedQuantity?: number | null;
};

export type FulfillmentItem = {
  productId: string;
  quantity: number;
};

export type FulfillmentSelectionInput = {
  branches?: BranchSnapshot[];
  inventoryRecords?: InventorySnapshot[];
  items?: FulfillmentItem[];
  preferredBranchId?: string | null;
  customerState?: string | null;
  customerCity?: string | null;
  customerLatitude?: number | string | null;
  customerLongitude?: number | string | null;
};

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function availableQuantity(record?: InventorySnapshot | null) {
  if (!record) return 0;
  return Math.max(0, Number(record.quantity || 0) - Number(record.reservedQuantity || 0));
}

function parseCoordinate(value: unknown) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceKm(
  origin: { latitude?: number | string | null; longitude?: number | string | null },
  destination: { latitude?: number | string | null; longitude?: number | string | null }
) {
  const originLat = parseCoordinate(origin.latitude);
  const originLng = parseCoordinate(origin.longitude);
  const destinationLat = parseCoordinate(destination.latitude);
  const destinationLng = parseCoordinate(destination.longitude);

  if (originLat == null || originLng == null || destinationLat == null || destinationLng == null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latDelta = toRadians(destinationLat - originLat);
  const lngDelta = toRadians(destinationLng - originLng);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function branchMatchesLocation(branch: BranchSnapshot, customerState?: string | null, customerCity?: string | null) {
  const state = normalize(customerState);
  const city = normalize(customerCity);
  const branchState = normalize(branch.address?.state);
  const branchCity = normalize(branch.address?.city);

  return {
    state: Boolean(state && branchState && state === branchState),
    city: Boolean(city && branchCity && city === branchCity),
  };
}

function getBranchCoverageScore(
  branchId: string,
  items: FulfillmentItem[],
  inventoryByBranch: Map<string, Map<string, InventorySnapshot>>
) {
  const branchInventory = inventoryByBranch.get(branchId);
  if (!branchInventory) return null;

  let totalAvailable = 0;
  let totalRequired = 0;

  for (const item of items) {
    const record = branchInventory.get(item.productId);
    const available = availableQuantity(record);
    totalAvailable += available;
    totalRequired += Number(item.quantity || 0);

    if (available < Number(item.quantity || 0)) {
      return null;
    }
  }

  return {
    totalAvailable,
    surplus: totalAvailable - totalRequired,
  };
}

export function selectFulfillmentBranch(input: FulfillmentSelectionInput) {
  const branches = Array.isArray(input.branches) ? input.branches : [];
  const items = Array.isArray(input.items) ? input.items : [];

  if (branches.length === 0 || items.length === 0) return null;

  const activeBranches = branches.filter((branch) => branch.isActive !== false);
  if (activeBranches.length === 0) return null;

  const inventoryByBranch = new Map<string, Map<string, InventorySnapshot>>();
  for (const record of Array.isArray(input.inventoryRecords) ? input.inventoryRecords : []) {
    const branchId = String(record.branchId || '').trim();
    const productId = String(record.productId || '').trim();
    if (!branchId || !productId) continue;

    const branchMap = inventoryByBranch.get(branchId) || new Map<string, InventorySnapshot>();
    branchMap.set(productId, {
      ...record,
      branchId,
      productId,
      quantity: Number(record.quantity || 0),
      reservedQuantity: Number(record.reservedQuantity || 0),
    });
    inventoryByBranch.set(branchId, branchMap);
  }

  const preferredId = normalize(input.preferredBranchId);
  if (preferredId) {
    const preferred = activeBranches.find((branch) => normalize(branch.id) === preferredId);
    if (preferred && getBranchCoverageScore(preferred.id, items, inventoryByBranch)) {
      return preferred;
    }
  }

  const candidates = activeBranches
    .map((branch) => {
      const coverage = getBranchCoverageScore(branch.id, items, inventoryByBranch);
      if (!coverage) return null;

      const locationMatch = branchMatchesLocation(branch, input.customerState, input.customerCity);
      const distanceKm = getDistanceKm(
        { latitude: input.customerLatitude, longitude: input.customerLongitude },
        { latitude: branch.address?.latitude, longitude: branch.address?.longitude }
      );
      const radiusKm = Number(branch.deliveryRadiusKm || 0);
      const inDeliveryRadius = distanceKm == null || radiusKm <= 0 ? null : distanceKm <= radiusKm;

      return {
        branch,
        coverage,
        locationMatch,
        distanceKm,
        inDeliveryRadius,
      };
    })
    .filter(Boolean) as Array<{
    branch: BranchSnapshot;
    coverage: { totalAvailable: number; surplus: number };
    locationMatch: { state: boolean; city: boolean };
    distanceKm: number | null;
    inDeliveryRadius: boolean | null;
  }>;

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.inDeliveryRadius !== b.inDeliveryRadius) {
      if (a.inDeliveryRadius === true) return -1;
      if (b.inDeliveryRadius === true) return 1;
      if (a.inDeliveryRadius === false) return 1;
      if (b.inDeliveryRadius === false) return -1;
    }

    if (a.distanceKm != null || b.distanceKm != null) {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    }

    const stateScoreA = a.locationMatch.state ? 1 : 0;
    const stateScoreB = b.locationMatch.state ? 1 : 0;
    if (stateScoreA !== stateScoreB) return stateScoreB - stateScoreA;

    const cityScoreA = a.locationMatch.city ? 1 : 0;
    const cityScoreB = b.locationMatch.city ? 1 : 0;
    if (cityScoreA !== cityScoreB) return cityScoreB - cityScoreA;

    const workloadA = Number(a.branch.workloadScore || 0);
    const workloadB = Number(b.branch.workloadScore || 0);
    if (workloadA !== workloadB) return workloadA - workloadB;

    if (a.coverage.surplus !== b.coverage.surplus) {
      return b.coverage.surplus - a.coverage.surplus;
    }

    return a.coverage.totalAvailable - b.coverage.totalAvailable;
  });

  return candidates[0]?.branch ?? null;
}

export function getAvailableInventoryQuantity(record?: InventorySnapshot | null) {
  return availableQuantity(record);
}
