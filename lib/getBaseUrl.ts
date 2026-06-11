export function getBaseUrl() {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (publicUrl) {
    // If VERCEL_URL (no protocol) was provided, ensure https:// prefix
    if (!publicUrl.startsWith('http')) return `https://${publicUrl}`
    return publicUrl
  }

  const port = process.env.PORT || '3000'
  return `http://localhost:${port}`
}
