/**
 * Startup environment validation and documentation.
 *
 * This file performs non-throwing checks at server startup to log any
 * missing critical environment variables so the deployment logs clearly
 * indicate misconfiguration. Guards that enforce required variables at
 * runtime (for example in the checkout flow) are kept and will still
 * fail fast — this module only adds an early, explicit log message.
 *
 * Required env vars (server-side):
 * - BACKEND_URL: Backend base URL used to build callback URLs for payment
 *   providers. Examples:
 *     - Local development: http://localhost:3000
 *     - Vercel production: https://phlakesfabrics-backend.vercel.app
 *
 * - FRONTEND_URL: Frontend base URL used for redirects back to the UI.
 *   Examples:
 *     - Local development: http://localhost:5173
 *     - Production: https://www.phlakesfabrics.com
 *
 * - PAYSTACK_SECRET_KEY: Paystack server secret key (sk_test_... / sk_live_...)
 *
 * Notes:
 * - Do NOT derive BACKEND_URL from incoming request headers (req.headers.origin)
 *   because payment providers must call the backend domain directly. Using
 *   proxies or frontend dev servers for provider callbacks is insecure and
 *   unreliable.
 */

const required = ['BACKEND_URL', 'FRONTEND_URL', 'PAYSTACK_SECRET_KEY']

function prettyLog(name: string, present: boolean) {
  if (present) {
    console.info(`[env] ${name} = ${process.env[name]?.slice(0, 80)}`)
  } else {
    console.error(`[env] MISSING ${name} — this will break payment flows. Set it in your environment (Vercel: Project Settings → Environment Variables).`)
  }
}

for (const n of required) {
  prettyLog(n, Boolean(process.env[n]))
}

export {} // keep this module a module
