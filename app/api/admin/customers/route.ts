import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { requireAuthWithRole } from '../../../../lib/requireAuth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRole(req, 'admin');
    if (!auth.authorized) return auth.response;
    await dbConnect();
    // Fetch all users whose role is NOT 'admin'
    const customers = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).lean();
    const formatted = customers.map((c: any) => ({ ...c, id: c._id.toString(), _id: undefined }));
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
