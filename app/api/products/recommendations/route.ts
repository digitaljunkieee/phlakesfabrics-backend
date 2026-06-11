import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product';
import { getUserFromRequest } from '../../../../lib/auth';

function formatProduct(product: any) {
  return {
    ...product,
    id: String(product._id || product.id),
    _id: undefined,
    name: product.name || product.title,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

function scoreProduct(product: any, preferences: { categories: Set<string>; brands: Set<string>; collections: Set<string> }) {
  let score = 0;

  if (product.isFeatured) score += 50;
  if (preferences.categories.has(String(product.category || '').toLowerCase())) score += 25;
  if (preferences.brands.has(String(product.brand || '').toLowerCase())) score += 20;
  if (preferences.collections.has(String(product.collection_id || '').toLowerCase())) score += 15;

  score += Number(product.rating || 0) * 2;
  score += Number(product.reviewCount || 0) * 0.25;
  score += Math.min(20, Number(product.stock || 0) * 0.1);
  return score;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '8'), 1), 24);
    const user = await getUserFromRequest(req);

    const preferences = {
      categories: new Set<string>(),
      brands: new Set<string>(),
      collections: new Set<string>(),
    };
    const purchasedIds = new Set<string>();

    if (user?.id) {
      const orders = await Order.find({
        user: user.id,
        paymentStatus: { $in: ['paid', 'refunded'] },
      })
        .populate('items.product', 'title name category brand collection_id isFeatured rating reviewCount stock')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      for (const order of orders as any[]) {
        for (const item of Array.isArray(order.items) ? order.items : []) {
          const product = item.product && typeof item.product === 'object' ? item.product : null;
          const productId = String(product?._id || product?.id || item.product || '');
          if (productId) purchasedIds.add(productId);
          if (product?.category) preferences.categories.add(String(product.category).toLowerCase());
          if (product?.brand) preferences.brands.add(String(product.brand).toLowerCase());
          if (product?.collection_id) preferences.collections.add(String(product.collection_id).toLowerCase());
        }
      }
    }

    const query: Record<string, unknown> = { status: 'published' };
    if (purchasedIds.size > 0) {
      query._id = { $nin: Array.from(purchasedIds) };
    }

    const pool = await Product.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(60)
      .lean();

    const ranked = pool
      .map((product: any) => ({
        product,
        score: scoreProduct(product, preferences),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ product }) => formatProduct(product));

    let recommendations = ranked;
    let source = user?.id ? 'personalized' : 'featured';

    if (recommendations.length === 0) {
      recommendations = await Product.find({ status: 'published' })
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(limit)
        .lean()
        .then((items) => items.map(formatProduct));
      source = 'featured';
    }

    return NextResponse.json({
      success: true,
      data: recommendations,
      source,
      summary: {
        count: recommendations.length,
        personalized: Boolean(user?.id),
      },
    });
  } catch (err: any) {
    console.error('/api/products/recommendations error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to load recommendations' }, { status: 500 });
  }
}
