import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { getUserFromRequest } from '../../../../lib/auth';

function formatAddress(user: any) {
  const address = user?.address || {};
  if (!address.line1 && !address.city && !address.state) return null;
  return {
    id: String(user._id || user.id),
    user_id: String(user._id || user.id),
    street: address.line1 || '',
    city: address.city || '',
    state: address.state || '',
    country: address.country || 'Nigeria',
    zip: address.zip || '',
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const dbUser = await User.findById(user.id).select('-password').lean();
  const address = formatAddress(dbUser);
  return NextResponse.json({ success: true, data: address ? [address] : [] });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await dbConnect();
  const updated = await User.findByIdAndUpdate(
    user.id,
    {
      $set: {
        address: {
          line1: body.street || body.address || body.line1 || '',
          city: body.city || '',
          state: body.state || '',
          country: body.country || 'Nigeria',
          zip: body.zip || body.postal_code || '',
        },
      },
    },
    { new: true }
  ).select('-password').lean();

  return NextResponse.json({ success: true, data: formatAddress(updated) });
}
