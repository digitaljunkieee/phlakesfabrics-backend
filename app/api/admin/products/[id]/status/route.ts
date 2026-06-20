import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../../lib/mongodb';
import Product from '../../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { formatProduct } from '../../../../../../lib/adminProduct';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, 'admin');
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const newStatus = String(body.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['draft', 'published', 'unpublished']);
  if (!allowedStatuses.has(newStatus)) {
    return NextResponse.json({ error: "Invalid status. Allowed: 'draft', 'published', 'unpublished'" }, { status: 400 });
  }

  await dbConnect();
  const product = await Product.findByIdAndUpdate(id, { $set: { status: newStatus } }, { returnDocument: 'after', runValidators: true }).lean();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ success: true, product: formatProduct(product) });
}
