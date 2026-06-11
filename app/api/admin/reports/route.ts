import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import Branch from '../../../../models/Branch';
import Inventory from '../../../../models/Inventory';
import Product from '../../../../models/Product';
import InventoryTransfer from '../../../../models/InventoryTransfer';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../lib/staffScope';

type ReportOrder = {
  _id?: string;
  branch?: any;
  branchName?: string | null;
  email?: string | null;
  totalAmount?: number | string | null;
  paymentStatus?: string | null;
  createdAt?: Date | string | null;
  items?: Array<{ product?: any; quantity?: number; price?: number }>;
};

function parseRange(range: string | null) {
  const normalized = String(range || '30d').toLowerCase();
  const end = new Date();
  const start = new Date(end);

  switch (normalized) {
    case '7d':
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case '90d':
    case 'quarter':
      start.setDate(start.getDate() - 90);
      break;
    case '12m':
    case 'year':
      start.setMonth(start.getMonth() - 12);
      break;
    case 'all':
      start.setFullYear(1970);
      break;
    case '30d':
    default:
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start, end, range: normalized };
}

function toDayKey(value: Date | string | null | undefined) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10);
}

function toMonthKey(value: Date | string | null | undefined) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toWeekKey(value: Date | string | null | undefined) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start.toISOString().slice(0, 10);
}

function getBranchInfo(order: ReportOrder) {
  const branchRecord = order.branch && typeof order.branch === 'object' ? order.branch : null;
  return {
    id: String(branchRecord?._id || branchRecord?.id || order.branch || ''),
    name: order.branchName || branchRecord?.name || 'Unassigned',
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);

    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const range = parseRange(url.searchParams.get('range'));
    const requestedBranchId = String(url.searchParams.get('branchId') || url.searchParams.get('branch') || '').trim();
    const branchId = scope.branchScoped ? scope.branchId : (requestedBranchId || null);
    const orderFilter: Record<string, unknown> = {
      createdAt: { $gte: range.start, $lte: range.end },
    };

    if (branchId) {
      orderFilter.branch = branchId;
    }

    const [orders, branches, inventories, transfers, totalBranches] = await Promise.all([
      Order.find(orderFilter).sort({ createdAt: 1 }).populate('branch', 'name slug code').lean(),
      Branch.find(scope.branchScoped && branchId ? { _id: branchId } : {}).select('name slug code isActive address workloadScore').lean(),
      Inventory.find(branchId ? { branch: branchId } : {}).populate('branch', 'name slug code').populate('product', 'title name slug image images').lean(),
      InventoryTransfer.find(branchId ? { $or: [{ fromBranch: branchId }, { toBranch: branchId }] } : {})
        .populate('fromBranch', 'name slug code')
        .populate('toBranch', 'name slug code')
        .populate('product', 'title name slug image images')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      scope.branchScoped ? Promise.resolve(branchId ? 1 : 0) : Branch.countDocuments({ isActive: { $ne: false } }),
    ]);

    const paidOrders = (orders as ReportOrder[]).filter((order) => order.paymentStatus === 'paid');
    const refundedOrders = (orders as ReportOrder[]).filter((order) => order.paymentStatus === 'refunded');
    const allRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const refundedRevenue = refundedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalRevenue = Math.max(0, allRevenue - refundedRevenue);

    const dayMap = new Map<string, { label: string; orders: number; revenue: number; refunds: number }>();
    const weekMap = new Map<string, { label: string; orders: number; revenue: number; refunds: number }>();
    const monthMap = new Map<string, { label: string; orders: number; revenue: number; refunds: number }>();
    const branchMap = new Map<string, { id: string; name: string; orders: number; revenue: number; refunds: number }>();
    const customerMap = new Map<string, { email: string; orders: number; revenue: number }>();
    const productMap = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();

    for (const order of orders as ReportOrder[]) {
      const orderValue = Number(order.totalAmount || 0);
      const dayKey = toDayKey(order.createdAt);
      const weekKey = toWeekKey(order.createdAt);
      const monthKey = toMonthKey(order.createdAt);
      const branchInfo = getBranchInfo(order);
      const customerKey = String(order.email || '').trim().toLowerCase() || 'unknown';

      const dayEntry = dayMap.get(dayKey) || { label: dayKey, orders: 0, revenue: 0, refunds: 0 };
      dayEntry.orders += 1;
      if (order.paymentStatus === 'refunded') dayEntry.refunds += orderValue;
      if (order.paymentStatus === 'paid') dayEntry.revenue += orderValue;
      dayMap.set(dayKey, dayEntry);

      const weekEntry = weekMap.get(weekKey) || { label: weekKey, orders: 0, revenue: 0, refunds: 0 };
      weekEntry.orders += 1;
      if (order.paymentStatus === 'refunded') weekEntry.refunds += orderValue;
      if (order.paymentStatus === 'paid') weekEntry.revenue += orderValue;
      weekMap.set(weekKey, weekEntry);

      const monthEntry = monthMap.get(monthKey) || { label: monthKey, orders: 0, revenue: 0, refunds: 0 };
      monthEntry.orders += 1;
      if (order.paymentStatus === 'refunded') monthEntry.refunds += orderValue;
      if (order.paymentStatus === 'paid') monthEntry.revenue += orderValue;
      monthMap.set(monthKey, monthEntry);

      const branchEntry = branchMap.get(branchInfo.id) || { id: branchInfo.id, name: branchInfo.name, orders: 0, revenue: 0, refunds: 0 };
      branchEntry.orders += 1;
      if (order.paymentStatus === 'refunded') branchEntry.refunds += orderValue;
      if (order.paymentStatus === 'paid') branchEntry.revenue += orderValue;
      branchMap.set(branchInfo.id, branchEntry);

      const customerEntry = customerMap.get(customerKey) || { email: String(order.email || 'unknown'), orders: 0, revenue: 0 };
      customerEntry.orders += 1;
      if (order.paymentStatus === 'paid') customerEntry.revenue += orderValue;
      customerMap.set(customerKey, customerEntry);

      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const productId = String(item.product?._id || item.product?.id || item.product || '').trim();
          if (!productId) continue;
          const existing = productMap.get(productId) || {
            productId,
            name: String(item.product?.title || item.product?.name || 'Unknown product'),
            quantity: 0,
            revenue: 0,
          };
          const qty = Number(item.quantity || 0);
          const lineRevenue = Number(item.price || 0) * qty;
          existing.quantity += qty;
          if (order.paymentStatus === 'paid') {
            existing.revenue += lineRevenue;
          }
          productMap.set(productId, existing);
        }
      }
    }

    const inventoryAlerts = (inventories || [])
      .map((entry: any) => {
        const available = Math.max(0, Number(entry.quantity || 0) - Number(entry.reservedQuantity || 0));
        return {
          id: String(entry._id || entry.id),
          inventoryId: String(entry._id || entry.id),
          branchId: String(entry.branch?._id || entry.branch?.id || entry.branch || ''),
          branchName: entry.branch?.name || 'Unknown branch',
          productId: String(entry.product?._id || entry.product?.id || entry.product || ''),
          productName: entry.product?.title || entry.product?.name || 'Unknown product',
          available,
          quantity: Number(entry.quantity || 0),
          reservedQuantity: Number(entry.reservedQuantity || 0),
          lowStockThreshold: Number(entry.lowStockThreshold || 0),
          status: entry.status || 'unknown',
        };
      })
      .filter((entry) => entry.status === 'low_stock' || entry.status === 'out_of_stock');

    const transferCount = transfers.length;

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const salesByDay = Array.from(dayMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    const salesByWeek = Array.from(weekMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    const salesByMonth = Array.from(monthMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    const branchPerformance = Array.from(branchMap.values()).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      data: {
        range,
        summary: {
          totalOrders: orders.length,
          paidOrders: paidOrders.length,
          refundedOrders: refundedOrders.length,
          grossRevenue: allRevenue,
          refundedRevenue,
          netRevenue: totalRevenue,
          averageOrderValue: paidOrders.length > 0 ? allRevenue / paidOrders.length : 0,
          activeBranches: totalBranches,
          branchCount: branches.length,
          transferCount,
          lowStockCount: inventoryAlerts.length,
          uniqueCustomers: customerMap.size,
        },
        salesByDay,
        salesByWeek,
        salesByMonth,
        branchPerformance,
        topProducts,
        topCustomers,
        inventoryAlerts,
        recentTransfers: transfers,
      },
    });
  } catch (error: any) {
    console.error('/api/admin/reports error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load reports' }, { status: 500 });
  }
}
