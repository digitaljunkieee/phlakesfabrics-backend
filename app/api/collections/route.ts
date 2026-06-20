import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Collection from '../../../models/Collection';
import Product from '../../../models/Product';

export async function GET() {
  try {
    await dbConnect();
    const collections = await Collection.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();
    const counts = await Product.aggregate([
      { $match: { status: 'published', collection_id: { $nin: [null, ''] } } },
      { $group: { _id: '$collection_id', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item: any) => [String(item._id), Number(item.count) || 0]));
    const formatted = collections.map((c: any) => ({
      ...c,
      id: c._id.toString(),
      _id: undefined,
      isActive: c.isActive !== false,
      productCount: countMap.get(String(c.slug)) || countMap.get(String(c._id)) || 0,
    }));
    return NextResponse.json({ success: true, collections: formatted, data: formatted }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}
