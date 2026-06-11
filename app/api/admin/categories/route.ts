import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Category from '../../../../models/Category';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import { findStoreCategory, STORE_CATEGORIES, STORE_CATEGORY_SLUGS } from '../../../../lib/storeCategories';

async function ensureStoreCategories() {
  await Promise.all(STORE_CATEGORIES.map((category) => (
    Category.updateOne(
      { slug: category.slug },
      {
        $set: {
          name: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
        },
        $setOnInsert: { isComingSoon: category.isComingSoon },
      },
      { upsert: true }
    )
  )));
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    await ensureStoreCategories();
    const categories = await Category.find({ slug: { $in: STORE_CATEGORY_SLUGS } }).sort({ sortOrder: 1, name: 1 }).lean();
    const formatted = categories.map((c: any) => ({ ...c, id: c._id.toString(), _id: undefined }));
    return NextResponse.json({ success: true, categories: formatted, data: formatted }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;

    await dbConnect();
    const body = await req.json();

    if (!body.slug && body.name) {
      body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const canonical = findStoreCategory(body.slug);
    if (!canonical) {
      return NextResponse.json({
        error: 'Categories are fixed to the approved Phlakes Fabrics category list.',
      }, { status: 400 });
    }

    const category = await Category.findOneAndUpdate(
      { slug: canonical.slug },
      {
        $set: {
          name: canonical.name,
          slug: canonical.slug,
          sortOrder: canonical.sortOrder,
        },
        $setOnInsert: { isComingSoon: canonical.isComingSoon },
        $unset: { parent_id: '' },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const formatted = { ...category.toObject(), id: category._id.toString(), _id: undefined };
    return NextResponse.json({ success: true, category: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Category Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 400 });
  }
}
