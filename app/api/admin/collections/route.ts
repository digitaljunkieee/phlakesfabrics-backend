import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Collection from '../../../../models/Collection';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

export async function GET(req: Request) {
  try {
    await dbConnect();
    const collections = await Collection.find({}).lean();
    const formatted = collections.map((c: any) => ({ ...c, id: c._id.toString(), _id: undefined }));
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
      body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const collection = await Collection.create(body);
    const formatted = { ...collection.toObject(), id: collection._id.toString(), _id: undefined };
    return NextResponse.json({ success: true, collection: formatted }, { status: 201 });
  } catch (error: any) {
    console.error('Collection Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create collection' }, { status: 400 });
  }
}
