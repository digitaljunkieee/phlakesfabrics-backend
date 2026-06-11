
const isDev = process.env.NODE_ENV !== 'production'

function timestamp() {
  return new Date().toISOString()
}

function safeFormat(meta) {
  try {
    if (!meta) return ''
    if (typeof meta === 'string') return meta
    return JSON.stringify(meta, (k, v) => (typeof v === 'function' ? '[function]' : v))
  } catch (e) {
    return String(meta)
  }
}

function info(msg, meta) {
  if (!isDev) return
  const suffix = meta ? ` ${safeFormat(meta)}` : ''
  // eslint-disable-next-line no-console
  console.log(`${timestamp()} [INFO] ${msg}${suffix}`)
}

function warn(msg, meta) {
  const suffix = meta ? ` ${safeFormat(meta)}` : ''
  // eslint-disable-next-line no-console
  console.warn(`${timestamp()} [WARN] ${msg}${suffix}`)
}

function error(msg, meta) {
  const suffix = meta ? ` ${safeFormat(meta)}` : ''
  // eslint-disable-next-line no-console
  console.error(`${timestamp()} [ERROR] ${msg}${suffix}`)
}

module.exports = { info, warn, error }
