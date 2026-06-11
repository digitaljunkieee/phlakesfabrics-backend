import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Order from '../../../../models/Order';
import { getUserFromRequest } from '../../../../lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    await dbConnect();
    const orders = await Order.find({ user: user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Order.countDocuments({ user: user.id });
    const formattedOrders = orders.map((o: any) => ({ ...o, id: o._id.toString(), _id: undefined }));

    return NextResponse.json({ success: true, data: formattedOrders, count: total }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}
