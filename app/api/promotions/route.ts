import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Product from '../../../models/Product';

const PROMOTION_SECTION_KEYS = ['campaign-shelf', 'promotional-fabrics'];

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

export async function GET(req: Request) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '8'), 1), 24);

    const products = await Product.find({
      status: 'published',
      homepage_sections: { $in: PROMOTION_SECTION_KEYS },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: products.map(formatProduct),
      banner: {
        title: 'Seasonal promotions',
        subtitle: 'Featured deals, discounts, and curated highlights from across the catalog.',
      },
    });
  } catch (err: any) {
    console.error('/api/promotions error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to load promotions' }, { status: 500 });
  }
}
