import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import InventoryLog from '../../../../../models/InventoryLog';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../lib/staffScope';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function formatLog(log: any) {
  return {
    id: String(log._id || log.id),
    inventoryId: String(log.inventory?._id || log.inventory?.id || log.inventory || ''),
    product: log.product || null,
    branch: log.branch || null,
    action: log.action || 'adjustment',
    quantityBefore: Number(log.quantityBefore || 0),
    quantityDelta: Number(log.quantityDelta || 0),
    quantityAfter: Number(log.quantityAfter || 0),
    performedBy: log.performedBy || null,
    referenceType: log.referenceType || null,
    referenceId: log.referenceId || null,
    notes: log.notes || null,
    metadata: log.metadata || null,
    createdAt: log.createdAt || null,
    updatedAt: log.updatedAt || null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);
    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const requestedBranchId = cleanString(url.searchParams.get('branchId') || url.searchParams.get('branch'));
    const productId = cleanString(url.searchParams.get('productId') || url.searchParams.get('product'));
    const action = cleanString(url.searchParams.get('action'));
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (scope.branchScoped) {
      if (requestedBranchId && requestedBranchId !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      query.branch = scope.branchId;
    } else if (requestedBranchId) {
      query.branch = requestedBranchId;
    }

    if (productId) query.product = productId;
    if (action) query.action = action;

    const [logs, total] = await Promise.all([
      InventoryLog.find(query)
        .populate('branch', 'name slug code')
        .populate('product', 'name title slug image images')
        .populate('inventory', 'quantity reservedQuantity lowStockThreshold status')
        .populate('performedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryLog.countDocuments(query),
    ]);

    const formatted = logs.map(formatLog);
    return NextResponse.json({
      success: true,
      data: formatted,
      logs: formatted,
      pagination: { page, limit, total },
    });
  } catch (error: any) {
    console.error('/api/admin/inventory/logs GET error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load inventory logs' }, { status: 500 });
  }
}
