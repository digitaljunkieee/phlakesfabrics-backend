import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../lib/mongodb';
import Product from '../../../models/Product';
import Review from '../../../models/Review';
import User from '../../../models/User';
import { getUserFromRequest } from '../../../lib/auth';
import { refreshProductReviewStats } from '../../../lib/reviewStats';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function productLookup(identifier: string) {
  const clauses: Record<string, unknown>[] = [{ slug: identifier }, { id: identifier }, { external_id: identifier }, { product_id: identifier }];
  if (mongoose.Types.ObjectId.isValid(identifier)) clauses.unshift({ _id: identifier });
  return { $or: clauses };
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
  try {
    await dbConnect();
    const url = new URL(req.url);
    const productId = cleanString(url.searchParams.get('productId') || url.searchParams.get('product'));
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '20'), 1), 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { status: { $ne: 'rejected' } };
    if (productId) {
      const product = await Product.findOne(productLookup(productId)).select('_id').lean();
      if (!product) return NextResponse.json({ success: true, data: [], reviews: [], pagination: { page, limit, total: 0 } });
      query.product = product._id;
    }

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
    console.error('/api/reviews GET error', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const productId = cleanString(body.productId || body.product || body.product_id);
    const product = await Product.findOne(productLookup(productId)).select('_id').lean();
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

    const rating = Number(body.rating);
    const comment = cleanString(body.comment);
    const photos = Array.isArray(body.photos)
      ? body.photos.map((photo: unknown) => cleanString(photo)).filter(Boolean).slice(0, 6)
      : [];

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Rating must be between 1 and 5' }, { status: 400 });
    }
    if (comment.length < 3) {
      return NextResponse.json({ success: false, error: 'Review comment is required' }, { status: 400 });
    }

    const review = await Review.create({
      product: product._id,
      user: user?.id || null,
      rating,
      comment,
      photos,
      status: body.status === 'pending' ? 'pending' : 'approved',
    });

    await refreshProductReviewStats(product._id);
    return NextResponse.json({ success: true, review: formatReview(review), data: formatReview(review) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create review';
    console.error('/api/reviews POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
