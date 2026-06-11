import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Branch from '../../../../models/Branch';
import Inventory from '../../../../models/Inventory';
import InventoryLog from '../../../../models/InventoryLog';
import Product from '../../../../models/Product';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

type JsonObject = Record<string, unknown>;

type InventoryPayload = {
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

function buildInventoryPayload(body: unknown): InventoryPayload {
  const input = asRecord(body);
  const payload: InventoryPayload = {};

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

export async function GET(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(req.url);
    const requestedBranchId = cleanString(url.searchParams.get('branchId') || url.searchParams.get('branch'));
    const productId = cleanString(url.searchParams.get('productId') || url.searchParams.get('product'));
    const status = cleanString(url.searchParams.get('status'));
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);
    const skip = (page - 1) * limit;

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const query: JsonObject = {};
    if (scope.branchScoped) {
      if (requestedBranchId && requestedBranchId !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      query.branch = scope.branchId;
    } else if (requestedBranchId) {
      query.branch = requestedBranchId;
    }

    if (productId) query.product = productId;
    if (status) query.status = status;

    const [items, total] = await Promise.all([
      Inventory.find(query)
        .populate('branch', 'name slug code isActive address')
        .populate('product', 'name title slug price stock images status')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(query),
    ]);

    const formatted = items.map(formatInventory);

    return NextResponse.json(
      {
        success: true,
        data: formatted,
        inventory: formatted,
        pagination: { page, limit, total },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory';
    console.error('/api/admin/inventory GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const payload = buildInventoryPayload(body);

    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    if (scope.branchScoped) {
      if (payload.branch && payload.branch !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      payload.branch = scope.branchId || undefined;
    }

    if (!payload.branch) {
      return NextResponse.json({ success: false, error: 'Branch is required' }, { status: 400 });
    }
    if (!payload.product) {
      return NextResponse.json({ success: false, error: 'Product is required' }, { status: 400 });
    }

    const [branch, product] = await Promise.all([
      Branch.findById(payload.branch).select('_id name').lean(),
      Product.findById(payload.product).select('_id name title').lean(),
    ]);

    if (!branch) return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

    const existingInventory = await Inventory.findOne({ branch: payload.branch, product: payload.product }).lean();

    const inventory = await Inventory.findOneAndUpdate(
      { branch: payload.branch, product: payload.product },
      {
        $set: compact({
          quantity: payload.quantity ?? 0,
          reservedQuantity: payload.reservedQuantity ?? 0,
          lowStockThreshold: payload.lowStockThreshold ?? 0,
          status: payload.status,
          notes: payload.notes,
          lastAdjustedBy: auth.user?.id || null,
        }),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )
      .populate('branch', 'name slug code isActive address')
      .populate('product', 'name title slug price stock images status')
      .lean();

    const beforeQuantity = Number(existingInventory?.quantity || 0);
    const afterQuantity = Number(inventory?.quantity || 0);

    if (inventory) {
      const inventoryId = String(inventory._id || inventory.id || '');
      const branchId = String(payload.branch || '');
      const productId = String(payload.product || '');

      await new InventoryLog({
        inventory: inventoryId || null,
        product: productId || null,
        branch: branchId || null,
        action: existingInventory ? 'adjustment' : 'restock',
        quantityBefore: beforeQuantity,
        quantityDelta: afterQuantity - beforeQuantity,
        quantityAfter: afterQuantity,
        performedBy: auth.user?.id || null,
        referenceType: 'inventory',
        referenceId: inventoryId,
        notes: payload.notes || 'Inventory updated',
        metadata: {
          source: 'admin_inventory_form',
          branchId,
          productId,
          reservedQuantity: Number(inventory.reservedQuantity || 0),
          lowStockThreshold: Number(inventory.lowStockThreshold || 0),
        },
      }).save();
    }

    return NextResponse.json({ success: true, inventory: formatInventory(inventory) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save inventory';
    console.error('/api/admin/inventory POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
