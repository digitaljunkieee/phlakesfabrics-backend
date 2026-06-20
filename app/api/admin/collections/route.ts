import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Collection from '../../../../models/Collection';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

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

export async function GET(req: Request) {
  try {
    await dbConnect();
    const collections = await Collection.find({}).sort({ name: 1 }).lean();
    const formatted = collections.map(formatCollection);
    return NextResponse.json({ success: true, collections: formatted, data: formatted }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
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

    const collection = await Collection.create(body);
    const formatted = formatCollection(collection);
    return NextResponse.json({ success: true, collection: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Collection Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create collection' }, { status: 400 });
  }
}
