import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import Inventory from '../../../../../../models/Inventory';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../../lib/staffScope';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function formatAlert(item: any) {
  const branch = item.branch && typeof item.branch === 'object' ? item.branch : null;
  const product = item.product && typeof item.product === 'object' ? item.product : null;
  const available = Math.max(0, Number(item.quantity || 0) - Number(item.reservedQuantity || 0));

  return {
    id: String(item._id || item.id),
    inventoryId: String(item._id || item.id),
    branchId: String(branch?._id || branch?.id || item.branch || ''),
    branchName: branch?.name || 'Unknown branch',
    branchSlug: branch?.slug || null,
    productId: String(product?._id || product?.id || item.product || ''),
    productName: product?.title || product?.name || 'Unknown product',
    productSlug: product?.slug || null,
    quantity: Number(item.quantity || 0),
    reservedQuantity: Number(item.reservedQuantity || 0),
    availableQuantity: available,
    lowStockThreshold: Number(item.lowStockThreshold || 0),
    status: item.status || 'unknown',
    notes: item.notes || null,
    updatedAt: item.updatedAt || null,
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
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);

    const query: Record<string, unknown> = { status: { $in: ['low_stock', 'out_of_stock'] } };
    if (scope.branchScoped) {
      if (requestedBranchId && requestedBranchId !== scope.branchId) {
        return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
      }
      query.branch = scope.branchId;
    } else if (requestedBranchId) {
      query.branch = requestedBranchId;
    }

    const alerts = await Inventory.find(query)
      .populate('branch', 'name slug code')
      .populate('product', 'name title slug image images')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const formatted = alerts.map(formatAlert);

    return NextResponse.json({
      success: true,
      data: formatted,
      alerts: formatted,
      summary: {
        total: formatted.length,
        lowStock: formatted.filter((item) => item.status === 'low_stock').length,
        outOfStock: formatted.filter((item) => item.status === 'out_of_stock').length,
      },
    });
  } catch (error: any) {
    console.error('/api/admin/inventory/alerts/low-stock GET error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load low stock alerts' }, { status: 500 });
  }
}
