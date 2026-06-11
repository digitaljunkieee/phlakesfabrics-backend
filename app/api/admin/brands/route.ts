import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Brand from '../../../../models/Brand';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

export async function GET(req: Request) {
  try {
    await dbConnect();
    const brands = await Brand.find({}).lean();
    const formatted = brands.map((b: any) => ({ ...b, id: b._id.toString(), _id: undefined }));
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
      body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const brand = await Brand.create(body);
    const formatted = { ...brand.toObject(), id: brand._id.toString(), _id: undefined };
    return NextResponse.json({ success: true, brand: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Brand Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create brand' }, { status: 400 });
  }
}
