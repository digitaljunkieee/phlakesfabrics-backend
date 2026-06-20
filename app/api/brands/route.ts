import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Brand from '../../../models/Brand';
import Product from '../../../models/Product';

export async function GET() {
  try {
    await dbConnect();

    const brands = await Brand.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();
    const [brandIdCounts, brandNameCounts] = await Promise.all([
      Product.aggregate([
        { $match: { status: 'published', brand_id: { $nin: [null, ''] } } },
        { $group: { _id: '$brand_id', count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: { status: 'published', brand: { $nin: [null, ''] } } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(
      [...brandIdCounts, ...brandNameCounts].map((item: any) => [String(item._id), Number(item.count) || 0])
    );

    const formatted = brands.map((brand: any) => ({
      ...brand,
      id: brand._id.toString(),
      _id: undefined,
      isActive: brand.isActive !== false,
      productCount:
        countMap.get(String(brand.slug)) ||
        countMap.get(String(brand._id)) ||
        countMap.get(String(brand.name)) ||
        0,
    }));

    return NextResponse.json({ success: true, brands: formatted, data: formatted }, { status: 200 });
  } catch (error) {
    console.error('Brand fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}
