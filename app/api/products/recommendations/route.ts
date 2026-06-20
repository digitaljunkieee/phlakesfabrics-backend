import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';

const RECOMMENDATION_SECTION_KEYS = ['recommended-fabrics', 'recommended', 'personalized-shelf'];

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

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '8'), 1), 24);
    const recommendations = await Product.find({
      status: 'published',
      homepage_sections: { $in: RECOMMENDATION_SECTION_KEYS },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean()
      .then((items) => items.map(formatProduct));

    return NextResponse.json({
      success: true,
      data: recommendations,
      source: 'admin-selected',
      summary: {
        count: recommendations.length,
        personalized: false,
      },
    });
  } catch (err: any) {
    console.error('/api/products/recommendations error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to load recommendations' }, { status: 500 });
  }
}
