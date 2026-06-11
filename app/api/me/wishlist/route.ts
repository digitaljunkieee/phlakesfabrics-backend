import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth'; // Ensure this path is correct
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import Product from '../../../../models/Product'; // Needed to populate the real product data

export async function GET(req: Request) {
  try {
    const authUser = await getUserFromRequest(req);
    if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    
    // Fetch the user and populate their wishlist array with actual Product documents
    const user = await User.findById(authUser.id).populate('wishlist').lean();
    
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // Format the products to use 'id' instead of '_id' for the frontend
    const formattedWishlist = (user.wishlist || []).map((p: any) => ({
      ...p,
      id: p._id.toString(),
      _id: undefined
    }));

    return NextResponse.json({ success: true, data: formattedWishlist }, { status: 200 });
  } catch (error) {
    console.error('Wishlist GET error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getUserFromRequest(req);
    if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const body = await req.json();
    
    // Support multiple shapes the frontend might send
    const productId = body.productId || body.id || body._id;

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    // $addToSet safely adds the ID only if it doesn't already exist in the array
    await User.findByIdAndUpdate(authUser.id, { 
      $addToSet: { wishlist: productId } 
    });

    return NextResponse.json({ success: true, message: 'Added to wishlist' }, { status: 200 });
  } catch (error) {
    console.error('Wishlist POST error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getUserFromRequest(req);
    if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    
    // The frontend might send the ID via the URL Query (?productId=123) OR in the JSON Body
    const { searchParams } = new URL(req.url);
    let productId = searchParams.get('productId');

    if (!productId) {
      const body = await req.json().catch(() => ({})); // Safe JSON parse fallback
      productId = body.productId || body.id || body._id;
    }

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    // $pull removes the specific ID from the array
    await User.findByIdAndUpdate(authUser.id, { 
      $pull: { wishlist: productId } 
    });

    return NextResponse.json({ success: true, message: 'Removed from wishlist' }, { status: 200 });
  } catch (error) {
    console.error('Wishlist DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}