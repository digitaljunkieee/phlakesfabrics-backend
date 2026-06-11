import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';

function formatProduct(product: any) {
  return {
    ...product,
    id: String(product._id || product.id),
    _id: undefined,
    name: product.name || product.title,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

export async function GET() {
  try {
    await dbConnect();
    let products = await Product.find({ isFeatured: true, status: 'published' }).sort({ createdAt: -1 }).limit(12).lean();
    if (products.length === 0) {
      products = await Product.find({ status: 'published' }).sort({ createdAt: -1 }).limit(12).lean();
    }
    return NextResponse.json({ success: true, data: products.map(formatProduct) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
