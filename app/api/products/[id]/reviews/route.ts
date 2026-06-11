import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Review from '../../../../../models/Review';
import Product from '../../../../../models/Product';

function productLookupQuery(identifier: string) {
  const clauses: Record<string, any>[] = [
    { slug: identifier },
    { id: identifier },
    { external_id: identifier },
    { product_id: identifier },
  ];

  if (mongoose.Types.ObjectId.isValid(identifier)) clauses.unshift({ _id: identifier });
  return { $or: clauses };
}

async function resolveProduct(identifier: string) {
  const normalized = String(identifier || '').trim();
  if (!normalized) return null;
  return Product.findOne(productLookupQuery(normalized)).lean();
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await context.params;

    if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

    const product = await resolveProduct(id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const data = await Review.find({ product: (product as any)._id }).sort({ createdAt: -1 }).lean();

    const reviews = data.map((r: any) => ({
      ...r,
      id: r._id.toString(),
      _id: undefined,
      created_at: r.createdAt,
    }));

    const totalReviews = reviews.length;
    const rawAverage = totalReviews > 0 ? reviews.reduce((s: number, r: any) => s + (Number(r.rating) || 0), 0) / totalReviews : null;
    const averageRating = rawAverage != null ? Number(rawAverage.toFixed(2)) : null;

    const ratingCounts: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    reviews.forEach((r: any) => {
      let rt = Math.round(Number(r.rating) || 0);
      if (rt < 1) rt = 1;
      if (rt > 5) rt = 5;
      ratingCounts[String(rt)]++;
    });

    const ratingPercentages: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    if (totalReviews > 0) {
      Object.keys(ratingCounts).forEach((k) => {
        ratingPercentages[k] = Number(((ratingCounts[k] / totalReviews) * 100).toFixed(1));
      });
    }

    return NextResponse.json({ reviews, totalReviews, averageRating, ratingCounts, ratingPercentages }, { status: 200 });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await context.params;

    if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

    const body = await req.json();
    const { rating, comment } = body;
    const photos = Array.isArray(body?.photos)
      ? body.photos.map((photo: unknown) => String(photo || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    const product = await resolveProduct(id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'Rating must be a number between 1 and 5' }, { status: 400 });
    }

    const newReview = await Review.create({
      product: (product as any)._id,
      rating: numericRating,
      comment: comment?.trim(),
      photos,
    });

    const allReviews = await Review.find({ product: (product as any)._id });
    const newReviewCount = allReviews.length;
    const newAverageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / newReviewCount;

    await Product.findByIdAndUpdate((product as any)._id, {
      rating: Number(newAverageRating.toFixed(1)),
      reviewCount: newReviewCount,
    });

    const created = {
      ...newReview.toObject(),
      id: newReview._id.toString(),
      created_at: newReview.createdAt,
    };

    return NextResponse.json({ review: created }, { status: 201 });
  } catch (error) {
    console.error('Post review error:', error);
    return NextResponse.json({ error: 'Failed to add review' }, { status: 500 });
  }
}
