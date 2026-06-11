import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Review from '../../../../models/Review';
import User from '../../../../models/User';
import { getUserFromRequest } from '../../../../lib/auth';
import { isAdminRole } from '../../../../lib/roles';
import { refreshProductReviewStats } from '../../../../lib/reviewStats';

function formatReview(review: any) {
  const raw = typeof review?.toObject === 'function' ? review.toObject() : review;
  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    _id: undefined,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    await dbConnect();
    const review = await Review.findById(id)
      .populate({ path: 'product', select: 'name title slug image images', model: Product })
      .populate({ path: 'user', select: 'name email', model: User })
      .lean();

    if (!review || review.status === 'rejected') {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatReview(review), review: formatReview(review) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load review';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    await dbConnect();
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const review = await Review.findById(id);
    if (!review) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });

    const ownsReview = review.user && String(review.user) === String(user.id);
    if (!ownsReview && !isAdminRole(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const productId = review.product;
    await review.deleteOne();
    await refreshProductReviewStats(productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete review';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
