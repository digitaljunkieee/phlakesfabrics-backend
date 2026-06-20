import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Category from '../../../../../models/Category';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function formatCategory(category: any) {
  const obj = typeof category.toObject === 'function' ? category.toObject() : category;
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
    if (body.parent_id === '') body.parent_id = undefined;

    const updated = await Category.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const formatted = formatCategory(updated);
    return NextResponse.json({ success: true, category: formatted });
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
    const category = await Category.findById(id).lean();
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const values = [String((category as any)._id), (category as any).slug, (category as any).name].filter(Boolean);
    const productCount = await Product.countDocuments({
      $or: [
        { category: { $in: values } },
        { category_id: { $in: values } },
      ],
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category while ${productCount} product${productCount === 1 ? '' : 's'} use it. Deactivate it or detach products first.` },
        { status: 409 }
      );
    }

    await Category.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete category' }, { status: 500 });
  }
}
