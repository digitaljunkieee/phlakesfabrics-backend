import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Review from '../../../../models/Review';
import User from '../../../../models/User';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function formatReview(review: any) {
  const raw = typeof review?.toObject === 'function' ? review.toObject() : review;
  const product = raw.product && typeof raw.product === 'object' ? raw.product : null;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;

  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    product: product
      ? {
          id: String(product._id || product.id || ''),
          name: product.name || product.title || null,
          slug: product.slug || null,
          image: product.image || product.images?.[0] || null,
        }
      : raw.product || null,
    user: user
      ? {
          id: String(user._id || user.id || ''),
          name: user.name || null,
          email: user.email || null,
        }
      : null,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const url = new URL(req.url);
    const status = cleanString(url.searchParams.get('status')).toLowerCase();
    const productId = cleanString(url.searchParams.get('productId') || url.searchParams.get('product'));
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '50'), 1), 200);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (['pending', 'approved', 'rejected'].includes(status)) query.status = status;
    if (productId) query.product = productId;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate({ path: 'product', select: 'name title slug image images', model: Product })
        .populate({ path: 'user', select: 'name email', model: User })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(query),
    ]);

    const data = reviews.map(formatReview);
    return NextResponse.json({ success: true, data, reviews: data, pagination: { page, limit, total } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load reviews';
    console.error('/api/admin/reviews GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
