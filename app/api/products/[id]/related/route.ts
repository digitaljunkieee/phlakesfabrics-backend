import { NextResponse, NextRequest } from 'next/server';
import { getRelatedProducts } from '../../../../../lib/related';

const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing product id' }, { status: 400, headers: PUBLIC_CORS_HEADERS });
  }

  try {
    const limit = Number(new URL(req.url).searchParams.get('limit') || '8');
    const res = await getRelatedProducts(id, Math.max(1, Math.min(50, limit)));
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error ?? 'Failed to load related products' }, { status: res.status || 500, headers: PUBLIC_CORS_HEADERS });
    }
    return NextResponse.json({ success: true, data: res.data ?? [] }, { headers: PUBLIC_CORS_HEADERS });
  } catch (err: any) {
    console.error('[api/products/[id]/related] error', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, headers: PUBLIC_CORS_HEADERS });
  }
}
