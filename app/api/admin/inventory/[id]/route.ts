import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Branch from '../../../../../models/Branch';
import Inventory from '../../../../../models/Inventory';
import InventoryLog from '../../../../../models/InventoryLog';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../lib/staffScope';

type JsonObject = Record<string, unknown>;

type InventoryUpdatePayload = {
  branch?: string;
  product?: string;
  quantity?: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  status?: string;
  notes?: string | null;
  lastAdjustedBy?: string | null;
};

function asRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' ? (value as JsonObject) : {};
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function resolveId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') {
    const record = asRecord(value);
    return cleanString(record.id || record._id || record.productId || record.branchId);
  }
  return cleanString(value);
}

function formatInventory(item: unknown) {
  const candidate = item as { toObject?: () => unknown };
  const raw = typeof candidate?.toObject === 'function' ? asRecord(candidate.toObject()) : asRecord(item);
  const branchRecord = asRecord(raw.branch);
  const productRecord = asRecord(raw.product);

  const branch =
    Object.keys(branchRecord).length > 0
      ? {
          id: String(branchRecord._id || branchRecord.id || ''),
          name: (branchRecord.name as string | null | undefined) || null,
          slug: (branchRecord.slug as string | null | undefined) || null,
          code: (branchRecord.code as string | null | undefined) || null,
          isActive: Boolean(branchRecord.isActive),
        }
      : raw.branch || null;

  const product =
    Object.keys(productRecord).length > 0
      ? {
          id: String(productRecord._id || productRecord.id || ''),
          name: (productRecord.name as string | null | undefined) || (productRecord.title as string | null | undefined) || null,
          title: (productRecord.title as string | null | undefined) || (productRecord.name as string | null | undefined) || null,
          slug: (productRecord.slug as string | null | undefined) || null,
          price: Number(productRecord.price || 0),
          stock: Number(productRecord.stock || 0),
        }
      : raw.product || null;

  const quantity = Number(raw.quantity || 0);
  const reservedQuantity = Number(raw.reservedQuantity || 0);

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    branch,
    product,
    branchId: cleanString(branch ? asRecord(branch).id : raw.branch || ''),
    productId: cleanString(product ? asRecord(product).id : raw.product || ''),
    availableQuantity: Math.max(0, quantity - reservedQuantity),
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function buildInventoryPayload(body: unknown): InventoryUpdatePayload {
  const input = asRecord(body);
  const payload: InventoryUpdatePayload = {};

  if (input.branchId !== undefined || input.branch !== undefined || input.branch_id !== undefined) {
    payload.branch = resolveId(input.branchId || input.branch || input.branch_id) || undefined;
  }
  if (input.productId !== undefined || input.product !== undefined || input.product_id !== undefined) {
    payload.product = resolveId(input.productId || input.product || input.product_id) || undefined;
  }
  if (input.quantity !== undefined) payload.quantity = Number(input.quantity) || 0;
  if (input.reservedQuantity !== undefined || input.reserved_quantity !== undefined) {
    payload.reservedQuantity = Number(input.reservedQuantity ?? input.reserved_quantity ?? 0) || 0;
  }
  if (input.lowStockThreshold !== undefined || input.low_stock_threshold !== undefined) {
    payload.lowStockThreshold = Number(input.lowStockThreshold ?? input.low_stock_threshold ?? 0) || 0;
  }
  if (input.status !== undefined) payload.status = cleanString(input.status) || undefined;
  if (input.notes !== undefined) payload.notes = cleanString(input.notes) || null;
  if (input.lastAdjustedBy !== undefined || input.last_adjusted_by !== undefined) {
    payload.lastAdjustedBy = cleanString(input.lastAdjustedBy || input.last_adjusted_by) || null;
  }

  return payload;
}

function compact<T extends JsonObject>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const payload = buildInventoryPayload(body);

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const filter: JsonObject = { _id: id };
    if (scope.branchScoped) {
      if (payload.branch && payload.branch !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      filter.branch = scope.branchId;
      payload.branch = scope.branchId || undefined;
    }

    if (payload.branch) {
      const branch = await Branch.findById(payload.branch).select('_id').lean();
      if (!branch) return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    }
    if (payload.product) {
      const product = await Product.findById(payload.product).select('_id').lean();
      if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const currentInventory = await Inventory.findOne(filter).lean();

    const updates = compact({
      branch: payload.branch,
      product: payload.product,
      quantity: payload.quantity,
      reservedQuantity: payload.reservedQuantity,
      lowStockThreshold: payload.lowStockThreshold,
      status: payload.status,
      notes: payload.notes,
      lastAdjustedBy: payload.lastAdjustedBy || auth.user?.id || null,
    });

    const inventory = await Inventory.findOneAndUpdate(filter, { $set: updates }, { returnDocument: 'after', runValidators: true })
      .populate('branch', 'name slug code isActive address')
      .populate('product', 'name title slug price stock images status')
      .lean();

    if (!inventory) return NextResponse.json({ success: false, error: 'Inventory entry not found' }, { status: 404 });

    const beforeQuantity = Number(currentInventory?.quantity || 0);
    const afterQuantity = Number(inventory?.quantity || 0);
    const inventoryId = String(inventory._id || inventory.id || '');
    const currentBranchId =
      (currentInventory?.branch && typeof currentInventory.branch === 'object'
        ? currentInventory.branch._id || currentInventory.branch.id
        : currentInventory?.branch) || '';
    const currentProductId =
      (currentInventory?.product && typeof currentInventory.product === 'object'
        ? currentInventory.product._id || currentInventory.product.id
        : currentInventory?.product) || '';
    const inventoryBranchId =
      (inventory.branch && typeof inventory.branch === 'object'
        ? inventory.branch._id || inventory.branch.id
        : inventory.branch) || '';
    const inventoryProductId =
      (inventory.product && typeof inventory.product === 'object'
        ? inventory.product._id || inventory.product.id
        : inventory.product) || '';
    const branchId = String(payload.branch || currentBranchId || inventoryBranchId || '');
    const productId = String(payload.product || currentProductId || inventoryProductId || '');

    await new InventoryLog({
      inventory: inventoryId || null,
      product: productId || null,
      branch: branchId || null,
      action: 'adjustment',
      quantityBefore: beforeQuantity,
      quantityDelta: afterQuantity - beforeQuantity,
      quantityAfter: afterQuantity,
      performedBy: auth.user?.id || null,
      referenceType: 'inventory',
      referenceId: inventoryId,
      notes: payload.notes || 'Inventory adjusted',
      metadata: {
        source: 'admin_inventory_update',
        branchId,
        productId,
        reservedQuantity: Number(inventory.reservedQuantity || 0),
        lowStockThreshold: Number(inventory.lowStockThreshold || 0),
      },
    }).save();

    return NextResponse.json({ success: true, inventory: formatInventory(inventory) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update inventory';
    console.error('/api/admin/inventory/[id] PATCH error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const filter: JsonObject = { _id: id };
    if (scope.branchScoped) {
      filter.branch = scope.branchId;
    }

    const currentInventory = await Inventory.findOne(filter).lean();

    const inventory = await Inventory.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'inactive',
          quantity: 0,
          reservedQuantity: 0,
          lastAdjustedBy: auth.user?.id || null,
        },
      },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('branch', 'name slug code isActive address')
      .populate('product', 'name title slug price stock images status')
      .lean();

    if (!inventory) return NextResponse.json({ success: false, error: 'Inventory entry not found' }, { status: 404 });

    const inventoryId = String(inventory._id || inventory.id || '');
    const currentBranchId =
      (currentInventory?.branch && typeof currentInventory.branch === 'object'
        ? currentInventory.branch._id || currentInventory.branch.id
        : currentInventory?.branch) || '';
    const currentProductId =
      (currentInventory?.product && typeof currentInventory.product === 'object'
        ? currentInventory.product._id || currentInventory.product.id
        : currentInventory?.product) || '';
    const inventoryBranchId =
      (inventory.branch && typeof inventory.branch === 'object'
        ? inventory.branch._id || inventory.branch.id
        : inventory.branch) || '';
    const inventoryProductId =
      (inventory.product && typeof inventory.product === 'object'
        ? inventory.product._id || inventory.product.id
        : inventory.product) || '';
    const branchId = String(currentBranchId || inventoryBranchId || '');
    const productId = String(currentProductId || inventoryProductId || '');

    await new InventoryLog({
      inventory: inventoryId || null,
      product: productId || null,
      branch: branchId || null,
      action: 'release',
      quantityBefore: Number(currentInventory?.quantity || 0),
      quantityDelta: -Number(currentInventory?.quantity || 0),
      quantityAfter: 0,
      performedBy: auth.user?.id || null,
      referenceType: 'inventory',
      referenceId: inventoryId,
      notes: 'Inventory deactivated',
      metadata: {
        source: 'admin_inventory_deactivate',
        branchId,
        productId,
      },
    }).save();

    return NextResponse.json({ success: true, inventory: formatInventory(inventory) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate inventory entry';
    console.error('/api/admin/inventory/[id] DELETE error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
