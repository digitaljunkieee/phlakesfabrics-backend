import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Brand from '../../../../../models/Brand';
import Product from '../../../../../models/Product';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

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

    const updated = await Brand.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const formatted = formatBrand(updated);
    return NextResponse.json({ success: true, brand: formatted });
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
    const brand = await Brand.findById(id).lean();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const values = [String((brand as any)._id), (brand as any).slug, (brand as any).name].filter(Boolean);
    const productCount = await Product.countDocuments({
      $or: [
        { brand: { $in: values } },
        { brand_id: { $in: values } },
      ],
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete brand while ${productCount} product${productCount === 1 ? '' : 's'} use it. Deactivate it or detach products first.` },
        { status: 409 }
      );
    }

    await Brand.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete brand' }, { status: 500 });
  }
}
