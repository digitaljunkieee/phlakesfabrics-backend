import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const url = new URL(req.url);
    const search = String(url.searchParams.get('q') || '').trim();
    const category = url.searchParams.get('category');
    const minPriceRaw = url.searchParams.get('min_price');
    const maxPriceRaw = url.searchParams.get('max_price');
    const ratingRaw = url.searchParams.get('rating');
    const minPrice = minPriceRaw == null || minPriceRaw === '' ? null : Number(minPriceRaw);
    const maxPrice = maxPriceRaw == null || maxPriceRaw === '' ? null : Number(maxPriceRaw);
    const rating = ratingRaw == null || ratingRaw === '' ? null : Number(ratingRaw);
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '20'), 1), 100);
    const skip = (page - 1) * limit;

    const query: any = { status: 'published' };
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { title: expression },
        { name: expression },
        { description: expression },
        { short_description: expression },
        { category: expression },
        { category_id: expression },
        { collection_id: expression },
        { brand: expression },
      ];
    }
    if (category) {
      const categoryExpression = new RegExp(`^${escapeRegex(category)}$`, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ category: categoryExpression }, { category_id: categoryExpression }],
      });
    }
    if ((minPrice != null && !Number.isNaN(minPrice)) || (maxPrice != null && !Number.isNaN(maxPrice))) {
      query.price = {};
      if (minPrice != null && !Number.isNaN(minPrice)) query.price.$gte = minPrice;
      if (maxPrice != null && !Number.isNaN(maxPrice)) query.price.$lte = maxPrice;
    }
    if (rating != null && !Number.isNaN(rating)) query.rating = { $gte: rating };

    await dbConnect();
    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(query),
    ]);

    return NextResponse.json({ success: true, data: products.map(formatProduct), pagination: { page, limit, total } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
