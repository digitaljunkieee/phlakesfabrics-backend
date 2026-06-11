import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { buildProductPayload, formatProduct } from '../../../../lib/adminProduct';

export async function GET(req: Request) {
  try {
    await dbConnect();
    const products = await Product.find({}).sort({ createdAt: -1 }).lean();
    const formatted = products.map(formatProduct);
    return NextResponse.json({ products: formatted }, { status: 200 });
  } catch (error) {
    console.error("Product GET Error:", error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Verify Admin Access
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    // 2. Connect to MongoDB
    await dbConnect();
    const body = await req.json();
    const payload = buildProductPayload(body, 'create');

    // 4. Save to Database
    const product = await Product.create(payload);
    const formatted = formatProduct(product);
    
    // 5. Return success to the frontend
    return NextResponse.json({ product: formatted, success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Product Create Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 400 });
  }
}
