import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import User from '../../../../../models/User';
import { getUserFromRequest } from '../../../../../lib/auth';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (!id || id === 'undefined') {
    return NextResponse.json({ success: false, error: 'Missing or invalid id parameter' }, { status: 400 });
  }

  await dbConnect();
  await User.findByIdAndUpdate(user.id, { $pull: { wishlist: id } });
  return NextResponse.json({ success: true });
}
