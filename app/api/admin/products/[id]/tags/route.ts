import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../../lib/mongodb';
import Product from '../../../../../../models/Product';
import Category from '../../../../../../models/Category';
import Brand from '../../../../../../models/Brand';
import Collection from '../../../../../../models/Collection';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { formatProduct } from '../../../../../../lib/adminProduct';

const ALLOWED_FIELDS = new Set(['category', 'brand', 'collection']);

function clean(value: any) {
  return String(value ?? '').trim();
}

function productIdentifierQuery(id: string) {
  const clauses: Record<string, any>[] = [{ slug: id }, { id }];
  if (mongoose.Types.ObjectId.isValid(id)) clauses.unshift({ _id: id });
  return { $or: clauses };
}

function tagIdentifierQuery(value: string) {
  const clauses: Record<string, any>[] = [{ slug: value }, { name: value }];
  if (mongoose.Types.ObjectId.isValid(value)) clauses.unshift({ _id: value });
  return { $or: clauses };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const field = clean(body.field).toLowerCase();
    const value = clean(body.value);

    if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: 'Invalid tag field' }, { status: 400 });
    }

    await dbConnect();

    const update: Record<string, any> = {};
    if (field === 'category') {
      if (!value) {
        update.category = '';
        update.category_id = '';
      } else {
        const category = await Category.findOne(tagIdentifierQuery(value)).lean();
        const categorySlug = clean((category as any)?.slug || value);
        update.category = categorySlug;
        update.category_id = categorySlug;
      }
    } else if (field === 'brand') {
      if (!value) {
        update.brand = '';
        update.brand_id = '';
      } else {
        const brand = await Brand.findOne(tagIdentifierQuery(value)).lean();
        update.brand = clean((brand as any)?.name || value);
        update.brand_id = clean((brand as any)?.slug || value);
      }
    } else if (field === 'collection') {
      if (!value) {
        update.collection_id = '';
      } else {
        const collection = await Collection.findOne(tagIdentifierQuery(value)).lean();
        update.collection_id = clean((collection as any)?.slug || value);
      }
    }

    const product = await Product.findOneAndUpdate(
      productIdentifierQuery(id),
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, product: formatProduct(product) }, { status: 200 });
  } catch (error: any) {
    console.error('Product Tag Update Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product tag' }, { status: 500 });
  }
}
