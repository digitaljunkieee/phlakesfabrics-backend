import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Brand from '../../../../../models/Brand';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

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

    const updated = await Brand.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const formatted = { ...updated.toObject(), id: updated._id.toString(), _id: undefined };
    return NextResponse.json({ success: true, brand: formatted });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
