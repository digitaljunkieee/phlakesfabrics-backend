import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Collection from '../../../../../models/Collection';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function formatCollection(collection: any) {
  const obj = typeof collection.toObject === 'function' ? collection.toObject() : collection;
  return {
    ...obj,
    id: obj._id?.toString?.() || obj.id,
    _id: undefined,
    isActive: obj.isActive !== false,
  };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const body = await req.json();
    const { id } = await context.params;

    if (!body.slug && body.name) {
      body.slug = slugify(body.name);
    }
    if (body.slug) body.slug = slugify(body.slug);

    const updated = await Collection.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });

    const formatted = formatCollection(updated);
    return NextResponse.json({ success: true, collection: formatted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const { id } = await context.params;
    const collection = await Collection.findById(id).lean();
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });

    const values = [String((collection as any)._id), (collection as any).slug, (collection as any).name].filter(Boolean);
    const productCount = await Product.countDocuments({ collection_id: { $in: values } });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete collection while ${productCount} product${productCount === 1 ? '' : 's'} use it. Deactivate it or detach products first.` },
        { status: 409 }
      );
    }

    await Collection.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete collection' }, { status: 500 });
  }
}
