import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import HomepageContent from '../../../models/HomepageContent';
import { formatHomepageContent } from '../../../lib/homepageContent';

export async function GET() {
  try {
    await dbConnect();
    const content = await HomepageContent.findOne({ key: 'main' }).lean();
    return NextResponse.json({ success: true, data: formatHomepageContent(content) }, { status: 200 });
  } catch (error: any) {
    console.error('/api/homepage error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load homepage content' }, { status: 500 });
  }
}

