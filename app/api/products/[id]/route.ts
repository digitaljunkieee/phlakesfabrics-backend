import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Inventory from '../../../../models/Inventory';
import Branch from '../../../../models/Branch';
import { formatProduct } from '../../../../lib/adminProduct';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function getBranchAddress(branch: Record<string, any>) {
  const address = asRecord(branch.address);
  return [address.line1, address.city, address.state, address.country].filter(Boolean).join(', ');
}

function formatBranchAvailability(entry: Record<string, any>) {
  const branch = asRecord(entry.branch);
  const quantity = Number(entry.quantity || 0);
  const reservedQuantity = Number(entry.reservedQuantity || 0);
  const availableQuantity = Math.max(0, quantity - reservedQuantity);

  return {
    id: cleanString(entry._id || entry.id),
    inventoryId: cleanString(entry._id || entry.id),
    branchId: cleanString(branch._id || branch.id || entry.branch),
    branchName: cleanString(branch.name) || 'Branch',
    branchSlug: cleanString(branch.slug),
    branchCode: cleanString(branch.code),
    branchAddress: getBranchAddress(branch),
    branchPhone: cleanString(branch.phone),
    branchIsActive: branch.isActive !== false,
    deliveryRadiusKm: branch.deliveryRadiusKm ?? null,
    quantity,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold: Number(entry.lowStockThreshold || 0),
    status: entry.status || (availableQuantity > 0 ? 'in_stock' : 'out_of_stock'),
    canPickup: branch.isActive !== false && availableQuantity > 0,
    canDeliver: branch.isActive !== false && availableQuantity > 0,
  };
}

async function buildProductAvailability(productId: unknown, legacyStock: number) {
  const rows = await Inventory.find({ product: productId })
    .populate({ path: 'branch', select: 'name slug code address phone isActive deliveryRadiusKm', model: Branch })
    .sort({ quantity: -1, updatedAt: -1 })
    .lean();

  const branchAvailability = rows.map((entry: any) => formatBranchAvailability(entry));
  const activeRows = branchAvailability.filter((entry) => entry.branchIsActive && entry.status !== 'inactive');
  const totalAvailable = activeRows.reduce((sum, entry) => sum + Number(entry.availableQuantity || 0), 0);
  const inStockBranchCount = activeRows.filter((entry) => Number(entry.availableQuantity || 0) > 0).length;
  const lowStockBranchCount = activeRows.filter((entry) => entry.status === 'low_stock').length;
  const outOfStockBranchCount = activeRows.filter((entry) => Number(entry.availableQuantity || 0) <= 0).length;
  const fallbackAvailable = branchAvailability.length === 0 ? Math.max(0, Number(legacyStock || 0)) : totalAvailable;
  const status = fallbackAvailable <= 0 ? 'out_of_stock' : lowStockBranchCount > 0 ? 'low_stock' : 'in_stock';

  return {
    branchAvailability,
    availability: {
      status,
      totalAvailable: fallbackAvailable,
      branchCount: activeRows.length,
      inStockBranchCount,
      lowStockBranchCount,
      outOfStockBranchCount,
      hasBranchInventory: branchAvailability.length > 0,
      estimatedAvailability:
        fallbackAvailable > 0
          ? branchAvailability.length > 0
            ? 'Available for pickup or delivery from selected branches'
            : 'Available from online stock'
          : 'Restock pending',
    },
    totalAvailable: fallbackAvailable,
    inStockBranchCount,
    branchCount: activeRows.length,
  };
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 15 requires us to await the params promise first
    const params = await props.params;
    const identifier = decodeURIComponent(params.id || '').trim();
    
    await dbConnect();
    
    const product = mongoose.Types.ObjectId.isValid(identifier)
      ? await Product.findById(identifier).lean()
      : await Product.findOne({ slug: identifier }).lean();

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const formattedProduct = formatProduct(product);
    const availability = await buildProductAvailability(
      (product as Record<string, any>)._id,
      Number((product as Record<string, any>).stock || 0)
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...formattedProduct,
          ...availability,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Single Product Fetch Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    // 🚨 FIX 1: Next.js 15 requires awaiting the params promise (just like your GET function)
    const params = await props.params;
    
    await dbConnect();
    
    // Parse the incoming data (e.g., { category: "69ef..." })
    const body = await req.json();

    // Find the product by ID and update it with the new fields
    const updatedProduct = await Product.findByIdAndUpdate(
      params.id,
      { $set: body }, // $set ensures we only update the fields provided
      // 🚨 FIX 2: Fixed the Mongoose deprecation warning (replaced 'new: true' with 'returnDocument: "after"')
      { returnDocument: 'after', runValidators: true } 
    );

    if (!updatedProduct) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedProduct }, { status: 200 });
  } catch (error: any) {
    console.error("Product PATCH error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
