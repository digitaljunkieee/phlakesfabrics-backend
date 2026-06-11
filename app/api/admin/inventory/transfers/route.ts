import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Branch from '../../../../../models/Branch';
import Inventory from '../../../../../models/Inventory';
import InventoryLog from '../../../../../models/InventoryLog';
import InventoryTransfer from '../../../../../models/InventoryTransfer';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../lib/staffScope';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function toObjectId(value: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function formatTransfer(transfer: any) {
  return {
    id: String(transfer._id || transfer.id),
    product: transfer.product || null,
    fromBranch: transfer.fromBranch || null,
    toBranch: transfer.toBranch || null,
    quantity: Number(transfer.quantity || 0),
    status: transfer.status || 'pending',
    reason: transfer.reason || null,
    notes: transfer.notes || null,
    requestedBy: transfer.requestedBy || null,
    completedBy: transfer.completedBy || null,
    failureReason: transfer.failureReason || null,
    completedAt: transfer.completedAt || null,
    createdAt: transfer.createdAt || null,
    updatedAt: transfer.updatedAt || null,
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
    const branchId = scope.branchScoped ? scope.branchId : cleanString(url.searchParams.get('branchId') || url.searchParams.get('branch'));
    const productId = cleanString(url.searchParams.get('productId'));
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '25'), 1), 100);

    const query: Record<string, unknown> = {};
    if (branchId) {
      query.$or = [{ fromBranch: branchId }, { toBranch: branchId }];
    }
    if (productId) query.product = productId;

    const transfers = await InventoryTransfer.find(query)
      .populate('product', 'title name slug image images')
      .populate('fromBranch', 'name slug code')
      .populate('toBranch', 'name slug code')
      .populate('requestedBy', 'name email role')
      .populate('completedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, data: transfers.map(formatTransfer) });
  } catch (error: any) {
    console.error('/api/admin/inventory/transfers GET error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load transfers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);
    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const body = await req.json();
    const productId = cleanString(body.productId || body.product_id || body.product);
    const fromBranchId = scope.branchScoped ? String(scope.branchId || '') : cleanString(body.fromBranchId || body.from_branch_id || body.fromBranch || body.branchId);
    const toBranchId = cleanString(body.toBranchId || body.to_branch_id || body.toBranch);
    const quantity = Math.max(1, Number(body.quantity || 0));
    const reason = cleanString(body.reason || '');
    const notes = cleanString(body.notes || '');

    if (!productId || !fromBranchId || !toBranchId || !quantity) {
      return NextResponse.json({ success: false, error: 'productId, fromBranchId, toBranchId, and quantity are required' }, { status: 400 });
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json({ success: false, error: 'Source and destination branches must be different' }, { status: 400 });
    }

    if (scope.branchScoped && fromBranchId !== scope.branchId) {
      return NextResponse.json({ success: false, error: 'You can only transfer stock from your assigned branch' }, { status: 403 });
    }

    const [fromBranch, toBranch, product] = await Promise.all([
      Branch.findById(fromBranchId).select('_id name').lean(),
      Branch.findById(toBranchId).select('_id name').lean(),
      Product.findById(productId).select('_id title name slug image images').lean(),
    ]);

    if (!fromBranch) return NextResponse.json({ success: false, error: 'Source branch not found' }, { status: 404 });
    if (!toBranch) return NextResponse.json({ success: false, error: 'Destination branch not found' }, { status: 404 });
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const sourceInventory = await Inventory.findOne({ branch: fromBranchId, product: productId }).session(session);
      if (!sourceInventory) {
        throw new Error('Source branch does not stock this product');
      }

      const available = Number(sourceInventory.quantity || 0) - Number(sourceInventory.reservedQuantity || 0);
      if (available < quantity) {
        throw new Error('Not enough available stock in the source branch');
      }

      const sourceBefore = Number(sourceInventory.quantity || 0);
      const sourceAfter = sourceBefore - quantity;
      sourceInventory.quantity = sourceAfter;
      sourceInventory.lastAdjustedBy = auth.user?.id ? toObjectId(auth.user.id) : null;
      sourceInventory.notes = notes || sourceInventory.notes || null;
      await sourceInventory.save({ session });

      const destinationInventory =
        (await Inventory.findOne({ branch: toBranchId, product: productId }).session(session)) ||
        new Inventory({
          branch: toBranchId,
          product: productId,
          quantity: 0,
          reservedQuantity: 0,
          lowStockThreshold: sourceInventory.lowStockThreshold || 0,
        });

      const destinationBefore = Number(destinationInventory.quantity || 0);
      const destinationAfter = destinationBefore + quantity;
      destinationInventory.quantity = destinationAfter;
      destinationInventory.lastAdjustedBy = auth.user?.id ? toObjectId(auth.user.id) : null;
      destinationInventory.notes = notes || destinationInventory.notes || null;
      await destinationInventory.save({ session });

      const transfer = await InventoryTransfer.create(
        [
          {
            product: productId,
            fromBranch: fromBranchId,
            toBranch: toBranchId,
            quantity,
            status: 'completed',
            reason: reason || null,
            notes: notes || null,
            requestedBy: auth.user?.id ? toObjectId(auth.user.id) : null,
            completedBy: auth.user?.id ? toObjectId(auth.user.id) : null,
            completedAt: new Date(),
            failureReason: null,
          },
        ],
        { session }
      );

      const transferId = String(transfer[0]._id);
      const performedBy = auth.user?.id ? toObjectId(auth.user.id) : null;

      await Promise.all([
        new InventoryLog({
          inventory: sourceInventory._id,
          product: productId,
          branch: fromBranchId,
          action: 'transfer_out',
          quantityBefore: sourceBefore,
          quantityDelta: -quantity,
          quantityAfter: sourceAfter,
          performedBy,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: notes || reason || 'Inventory transfer out',
          metadata: { transferId, direction: 'out', toBranchId },
        }).save({ session }),
        new InventoryLog({
          inventory: destinationInventory._id,
          product: productId,
          branch: toBranchId,
          action: 'transfer_in',
          quantityBefore: destinationBefore,
          quantityDelta: quantity,
          quantityAfter: destinationAfter,
          performedBy,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: notes || reason || 'Inventory transfer in',
          metadata: { transferId, direction: 'in', fromBranchId },
        }).save({ session }),
      ]);

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({ success: true, data: formatTransfer(transfer[0]) }, { status: 201 });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error: any) {
    console.error('/api/admin/inventory/transfers POST error', error);
    const status = String(error?.message || '').toLowerCase().includes('not enough') ? 409 : 500;
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create transfer' }, { status });
  }
}
