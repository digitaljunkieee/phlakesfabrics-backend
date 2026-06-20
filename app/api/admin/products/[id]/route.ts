import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { buildProductPayload, formatProduct } from '../../../../../lib/adminProduct';
import { isAdminRole } from '../../../../../lib/roles';

function productIdentifierQuery(id: string) {
  const clauses: Record<string, any>[] = [{ slug: id }, { id }];
  if (mongoose.Types.ObjectId.isValid(id)) clauses.unshift({ _id: id });
  return { $or: clauses };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const body = await req.json();
    const payload = isAdminRole(auth.user?.role)
      ? buildProductPayload(body, 'update')
      : buildProductPayload({ colors: body?.colors }, 'update');

    if (!isAdminRole(auth.user?.role) && body?.colors === undefined) {
      return NextResponse.json({ error: 'Staff can only update product colors' }, { status: 403 });
    }
    const { id } = await context.params;

    const updatedProduct = await Product.findOneAndUpdate(
      productIdentifierQuery(id),
      { $set: payload },
      { returnDocument: 'after', runValidators: true }
    ).lean();
    
    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const formatted = formatProduct(updatedProduct);
    return NextResponse.json({ product: formatted, success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Product Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const { id } = await context.params;

    const deletedProduct = await Product.findOneAndDelete(productIdentifierQuery(id));
    
    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Product Delete Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
