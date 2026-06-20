import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Category from '../../../../models/Category';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

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

export async function GET(req: Request) {
  try {
    await dbConnect();
    const categories = await Category.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    const formatted = categories.map(formatCategory);
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
      body.slug = slugify(body.name);
    }

    body.slug = slugify(body.slug);
    body.isActive = body.isActive !== false;
    if (body.parent_id === '') body.parent_id = undefined;

    const category = await Category.create(body);
    const formatted = formatCategory(category);
    return NextResponse.json({ success: true, category: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Category Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 400 });
  }
}
