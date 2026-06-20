import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Category from '../../../models/Category';

function formatCategory(category: any) {
  return {
    ...category,
    id: category._id.toString(),
    _id: undefined,
    isActive: category.isActive !== false,
  };
}

export async function GET() {
  try {
    await dbConnect();
    const categories = await Category.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, name: 1 }).lean();
    const formatted = categories.map(formatCategory);
    return NextResponse.json({ success: true, categories: formatted, data: formatted }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
