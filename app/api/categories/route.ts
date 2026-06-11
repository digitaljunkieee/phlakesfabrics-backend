import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Category from '../../../models/Category';
import { STORE_CATEGORIES, STORE_CATEGORY_SLUGS } from '../../../lib/storeCategories';

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

export async function GET() {
  try {
    await dbConnect();
    await ensureStoreCategories();
    const categories = await Category.find({ slug: { $in: STORE_CATEGORY_SLUGS } }).sort({ sortOrder: 1, name: 1 }).lean();
    const formatted = categories.map((c: any) => ({ ...c, id: c._id.toString(), _id: undefined }));
    return NextResponse.json({ success: true, categories: formatted, data: formatted }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
