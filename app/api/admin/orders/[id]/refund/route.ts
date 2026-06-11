import { NextResponse, NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../../lib/mongodb';
import Order from '../../../../../../models/Order';
import Product from '../../../../../../models/Product';
import Inventory from '../../../../../../models/Inventory';
import InventoryLog from '../../../../../../models/InventoryLog';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { resolveStaffScope } from '../../../../../../lib/staffScope';
import { createPaystackRefund } from '../../../../../../lib/paystack.server';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function toObjectId(value: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function formatOrder(order: any) {
  return {
    ...order,
    id: String(order._id || order.id),
    _id: undefined,
  };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });
  }

  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const scope = await resolveStaffScope(auth.user);
    if (scope.branchScoped && !scope.hasBranchAccess) {
      return NextResponse.json({ success: false, error: 'Branch assignment required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = cleanString(body.reason || body.refundReason || 'Customer refund request');
    const orderFilter: Record<string, unknown> = { _id: id };
    if (scope.branchScoped) {
      orderFilter.branch = scope.branchId;
    }

    const order = await Order.findOne(orderFilter).lean();
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (String(order.paymentStatus || '').toLowerCase() === 'refunded') {
      return NextResponse.json({ success: false, error: 'Order already refunded' }, { status: 409 });
    }

    if (String(order.paymentStatus || '').toLowerCase() !== 'paid') {
      return NextResponse.json({ success: false, error: 'Only paid orders can be refunded' }, { status: 400 });
    }

    const refundAmount = Number(order.totalAmount || 0);
    if (!refundAmount) {
      return NextResponse.json({ success: false, error: 'Refund amount could not be determined' }, { status: 400 });
    }

    const transactionReference = cleanString(order.paystackReference || order._id || id);
    if (!transactionReference) {
      return NextResponse.json({ success: false, error: 'Paystack reference is missing for this order' }, { status: 400 });
    }

    const refundResponse = await createPaystackRefund({
      transaction: transactionReference,
      amount: Math.round(refundAmount * 100),
      customer_note: reason,
      merchant_note: `Refund for order ${String(order._id || id)}`,
    });

    if (!refundResponse?.status) {
      throw new Error(refundResponse?.message || 'Paystack refund request failed');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const orderDoc = await Order.findOne(orderFilter).session(session);
      if (!orderDoc) {
        throw new Error('Order not found');
      }

      const now = new Date();
      const branchId = orderDoc.branch ? String(orderDoc.branch) : null;
      const performedBy = auth.user?.id ? toObjectId(auth.user.id) : null;

      for (const item of Array.isArray(orderDoc.items) ? orderDoc.items : []) {
        const productId = String(item.product || '');
        const quantity = Math.max(1, Number(item.quantity || 0));
        if (!productId || !quantity) continue;

        const product = await Product.findById(productId).session(session);
        if (product) {
          product.stock = Number(product.stock || 0) + quantity;
          await product.save({ session });
        }

        if (!branchId) continue;

        const inventory =
          (await Inventory.findOne({ branch: branchId, product: productId }).session(session)) ||
          new Inventory({
            branch: branchId,
            product: productId,
            quantity: 0,
            reservedQuantity: 0,
            lowStockThreshold: 0,
          });

        const beforeQuantity = Number(inventory.quantity || 0);
        const afterQuantity = beforeQuantity + quantity;
        inventory.quantity = afterQuantity;
        inventory.lastAdjustedBy = performedBy;
        await inventory.save({ session });

        await new InventoryLog({
          inventory: inventory._id,
          product: productId,
          branch: branchId,
          action: 'refund',
          quantityBefore: beforeQuantity,
          quantityDelta: quantity,
          quantityAfter: afterQuantity,
          performedBy,
          referenceType: 'refund',
          referenceId: String(orderDoc._id || id),
          notes: reason || 'Refund stock returned',
          metadata: {
            source: 'admin_refund',
            orderId: String(orderDoc._id || id),
            transactionReference,
          },
        }).save({ session });
      }

      orderDoc.paymentStatus = 'refunded';
      orderDoc.refundStatus = 'completed';
      orderDoc.refundReference =
        String(refundResponse?.data?.reference || refundResponse?.data?.refund_reference || transactionReference || '');
      orderDoc.refundAmount = refundAmount;
      orderDoc.refundRequestedAt = orderDoc.refundRequestedAt || now;
      orderDoc.refundProcessedAt = now;
      orderDoc.refundReason = reason || null;
      orderDoc.refundLastError = null;
      await orderDoc.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({
        success: true,
        message: 'Refund processed successfully',
        order: formatOrder(orderDoc.toObject()),
        refund: {
          amount: refundAmount,
          reference: orderDoc.refundReference,
          status: orderDoc.refundStatus,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error: any) {
    console.error('/api/admin/orders/[id]/refund error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to process refund' }, { status: 500 });
  }
}
