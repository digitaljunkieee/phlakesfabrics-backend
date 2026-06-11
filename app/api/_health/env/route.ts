import { NextResponse } from 'next/server'

// Safe health endpoint to verify which env vars the running server process sees.
// Intentionally returns only booleans (no secrets).
export async function GET() {
  return NextResponse.json({
    mongoDb: !!process.env.MONGODB_URI,
    paystack: !!process.env.PAYSTACK_SECRET_KEY,
    cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET,
    brevo: !!process.env.BREVO_API_KEY || !!process.env.SENDINBLUE_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    adminEmail: !!process.env.ADMIN_EMAIL || !!process.env.ADMIN_NOTIFICATION_EMAIL || !!process.env.CONTACT_EMAIL,
    gig: !!process.env.GIG_BASE_URL && !!process.env.GIG_EMAIL && !!process.env.GIG_PASSWORD,
    nodeEnv: process.env.NODE_ENV ?? null,
  })
}
