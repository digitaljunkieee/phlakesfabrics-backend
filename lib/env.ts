
type EnvValue = string

const isVercel = Boolean(process.env.VERCEL)

function logMissing(name: string) {
  // eslint-disable-next-line no-console
  console.error(`[env] Missing required environment variable: ${name}`)
  if (isVercel) {
    // eslint-disable-next-line no-console
    console.error(`[env] Running on Vercel — set ${name} in Project Settings → Environment Variables.`)
  }
}

export function required(name: string): EnvValue {
  const val = process.env[name]
  if (val === undefined || val === null || val === '') {
    logMissing(name)
    throw new Error(`Environment variable ${name} is required but was not provided`)
  }
  return val
}

export function optional(name: string, fallback?: string): string | undefined {
  const val = process.env[name]
  if (val === undefined || val === null || val === '') return fallback
  return val
}

export function requiredNumber(name: string): number {
  const raw = required(name)
  const n = Number(raw)
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be a number, got: ${raw}`)
  return n
}

export function requiredBoolean(name: string): boolean {
  const raw = required(name).toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  throw new Error(`Environment variable ${name} must be a boolean (true/false), got: ${raw}`)
}

export function validateRequired(names: string[]) {
  for (const n of names) required(n)
}
