import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Brand from '../../../../models/Brand';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function formatBrand(brand: any) {
  const obj = typeof brand.toObject === 'function' ? brand.toObject() : brand;
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
    const brands = await Brand.find({}).sort({ name: 1 }).lean();
    const formatted = brands.map(formatBrand);
    return NextResponse.json({ success: true, brands: formatted, data: formatted }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
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

    const brand = await Brand.create(body);
    const formatted = formatBrand(brand);
    return NextResponse.json({ success: true, brand: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Brand Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create brand' }, { status: 400 });
  }
}
