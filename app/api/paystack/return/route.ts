import { NextResponse, NextRequest } from 'next/server';

function getCorsHeaders(req?: NextRequest) {
  const origin = req?.headers?.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function GET(req: NextRequest) {
  const frontendRaw = process.env.FRONTEND_URL;
  if (!frontendRaw) {
    throw new Error('FRONTEND_URL environment variable is required for paystack return redirects');
  }

  const reference = new URL(req.url).searchParams.get('reference');
  if (!reference) {
    throw new Error('Missing `reference` query parameter on Paystack return');
  }

  return NextResponse.redirect(`${String(frontendRaw).replace(/\/$/, '')}/payment/callback?reference=${encodeURIComponent(reference)}`);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
