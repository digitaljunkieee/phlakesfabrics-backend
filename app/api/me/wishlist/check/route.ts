import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import User from '../../../../../models/User';
import { getUserFromRequest } from '../../../../../lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const productId = new URL(req.url).searchParams.get('product_id');
  if (!productId) return NextResponse.json({ success: false, error: 'Missing product_id' }, { status: 400 });

  await dbConnect();
  const dbUser = await User.findById(user.id).select('wishlist').lean();
  const present = (dbUser?.wishlist || []).some((id: any) => String(id) === String(productId));
  return NextResponse.json({ success: true, present, id: present ? productId : null });
}
