import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../../lib/mongodb';
import Review from '../../../../../../models/Review';
import { requireAuthWithRole } from '../../../../../../lib/requireAuth';
import { refreshProductReviewStats } from '../../../../../../lib/reviewStats';

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

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

async function applyReviewAction(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
  }

  try {
    await dbConnect();
    const body = req.method === 'DELETE' ? {} : await req.json().catch(() => ({}));
    const action = cleanString((body as any).action || (body as any).status || (req.method === 'DELETE' ? 'delete' : '')).toLowerCase();
    const adminNote = cleanString((body as any).adminNote || (body as any).note);

    const review = await Review.findById(id);
    if (!review) return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    const productId = review.product;

    if (action === 'delete') {
      await review.deleteOne();
      await refreshProductReviewStats(productId);
      return NextResponse.json({ success: true, action: 'deleted' });
    }

    if (!['approve', 'approved', 'reject', 'rejected', 'pending'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Action must be approve, reject, pending, or delete' }, { status: 400 });
    }

    review.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action;
    review.adminNote = adminNote || null;
    await review.save();
    await refreshProductReviewStats(productId);

    return NextResponse.json({ success: true, data: formatReview(review), review: formatReview(review) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update review';
    console.error('/api/admin/reviews/[id]/action error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return applyReviewAction(req, context);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return applyReviewAction(req, context);
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  return applyReviewAction(req, context);
}
