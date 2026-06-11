import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Category from '../../../../../models/Category';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';
import { STORE_CATEGORIES } from '../../../../../lib/storeCategories';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const body = await req.json();
    const { id } = await context.params;

    if (!body.slug && body.name) {
      body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (body.parent_id === '') body.parent_id = undefined;

    const existing = await Category.findById(id).select('slug').lean();
    const slug = String(body.slug || (existing as any)?.slug || '').toLowerCase();
    const canonical = STORE_CATEGORIES.find((category) => category.slug === slug);
    if (canonical) {
      body.name = canonical.name;
      body.slug = canonical.slug;
      body.sortOrder = canonical.sortOrder;
      if (typeof body.isComingSoon !== 'boolean') body.isComingSoon = canonical.isComingSoon;
    }

    const updated = await Category.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const formatted = { ...updated.toObject(), id: updated._id.toString(), _id: undefined };
    return NextResponse.json({ success: true, category: formatted });
  } catch (e) { 
    return NextResponse.json({ error: 'Failed' }, { status: 500 }); 
  }
}
