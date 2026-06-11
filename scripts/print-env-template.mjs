#!/usr/bin/env node
const vars = [
  'FRONTEND_URL',
  'BACKEND_URL',
  'MONGODB_URI',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'SESSION_SECRET',
  'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'ADMIN_API_KEY',
  'GIG_BASE_URL',
  'GIG_EMAIL',
  'GIG_PASSWORD',
  'GIG_ORGANISATION',
  'GIG_USER_CHANNEL_CODE',
  'NODE_ENV',
  'PORT'
]

console.log('# Copy/paste these into Vercel or your .env.local and fill the values')
console.log(vars.map((k) => `${k}=`).join('\n'))
