import Product from '../models/Product';
import Review from '../models/Review';

export async function refreshProductReviewStats(productId: unknown) {
  if (!productId) return;
  const reviews = await Review.find({ product: productId, status: { $ne: 'rejected' } }).select('rating').lean();
  const reviewCount = reviews.length;
  const rating =
    reviewCount > 0
      ? Number((reviews.reduce((sum, review: any) => sum + Number(review.rating || 0), 0) / reviewCount).toFixed(1))
      : 0;

  await Product.findByIdAndUpdate(productId, { rating, reviewCount });
}
