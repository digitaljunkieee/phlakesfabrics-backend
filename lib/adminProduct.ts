// Helpers to normalize admin product payloads before persisting updates.
// The React admin form uses friendly fields like `name` and `category_id`,
// while older Mongo documents/routes also expect `title`, `slug`, and `category`.

type AnyObj = Record<string, any>

const DEFAULT_DESCRIPTION = 'No description provided.'
const ALLOWED_STATUSES = new Set(['draft', 'published', 'unpublished'])

function toNumberSafe(v: any, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isNaN(n) ? fallback : n
}

function toArraySafe(v: any): any[] {
  if (Array.isArray(v)) return v
  if (v == null || v === '') return []
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : [v]
    } catch {
      return [v]
    }
  }
  return []
}

function toStringList(v: any): string[] {
  const values = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(v)
            return Array.isArray(parsed) ? parsed : v.split(/[|,;]/)
          } catch {
            return v.split(/[|,;]/)
          }
        })()
      : []

  return Array.from(
    new Set(
      values
        .map((item) => cleanString(item).toLowerCase())
        .filter(Boolean)
    )
  )
}

function toObjectSafe(v: any): AnyObj {
  if (!v) return {}
  if (typeof v === 'object' && !Array.isArray(v)) return v
  try {
    const parsed = JSON.parse(String(v))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function cleanString(v: any): string {
  return String(v ?? '').trim()
}

export function slugify(value: any): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function removeUndefined(out: AnyObj): AnyObj {
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k]
  })
  return out
}

export function normalizeProductPayload(input: any): Record<string, any> {
  const src: AnyObj = input || {}
  const out: AnyObj = {}

  const displayName = cleanString(src.name ?? src.title ?? src.nam)
  if (displayName) {
    out.name = displayName
    out.title = displayName
  }
  if (src.title !== undefined && cleanString(src.title)) out.title = cleanString(src.title)
  if (src.slug !== undefined && cleanString(src.slug)) out.slug = slugify(src.slug)
  if (!out.slug && out.title) out.slug = slugify(out.title)

  if ('sku' in src) out.sku = cleanString(src.sku) || null

  if ('description' in src) {
    out.description = cleanString(src.description) || DEFAULT_DESCRIPTION
  }
  if (src.shortDescription !== undefined) out.short_description = cleanString(src.shortDescription)
  if (src.short_description !== undefined) out.short_description = cleanString(src.short_description)

  if (src.price !== undefined) out.price = toNumberSafe(src.price, null)
  if (src.compareAtPrice !== undefined) out.compare_at_price = toNumberSafe(src.compareAtPrice, null)
  else if (src.compare_at_price !== undefined) out.compare_at_price = toNumberSafe(src.compare_at_price, null)

  if (src.oldPrice !== undefined) out.old_price = toNumberSafe(src.oldPrice, null)
  else if (src.old_price !== undefined) out.old_price = toNumberSafe(src.old_price, null)

  if (src.priceText !== undefined) out.price_text = src.priceText ?? null
  else if (src.price_text !== undefined) out.price_text = src.price_text ?? null

  if (src.oldPriceText !== undefined) out.old_price_text = src.oldPriceText ?? null
  else if (src.old_price_text !== undefined) out.old_price_text = src.old_price_text ?? null

  if (src.stock !== undefined) out.stock = toNumberSafe(src.stock, 0)

  if (src.status !== undefined) {
    const status = cleanString(src.status).toLowerCase()
    if (ALLOWED_STATUSES.has(status)) out.status = status
  }

  if (src.isFeatured !== undefined) out.isFeatured = Boolean(src.isFeatured)
  else if (src.is_featured !== undefined) out.isFeatured = Boolean(src.is_featured)
  if (src.is_featured !== undefined) out.is_featured = Boolean(src.is_featured)

  const categoryId = src.categoryId ?? src.category_id ?? src.category
  if (categoryId !== undefined) {
    const value = cleanString(categoryId)
    out.category_id = value
    out.category = value
  }

  if (src.brand !== undefined) out.brand = cleanString(src.brand)
  if (src.brandId !== undefined) out.brand_id = cleanString(src.brandId)
  else if (src.brand_id !== undefined) out.brand_id = cleanString(src.brand_id)

  if (src.collectionId !== undefined) out.collection_id = cleanString(src.collectionId)
  else if (src.collection_id !== undefined) out.collection_id = cleanString(src.collection_id)

  if (src.homepageSections !== undefined) out.homepage_sections = toStringList(src.homepageSections)
  else if (src.homepage_sections !== undefined) out.homepage_sections = toStringList(src.homepage_sections)
  else if (src.homepage_section !== undefined) out.homepage_sections = toStringList(src.homepage_section)

  if (src.image !== undefined) out.image = src.image ?? null
  if (src.images !== undefined) {
    out.images = toArraySafe(src.images)
    if (!out.image && out.images[0]) out.image = out.images[0]
  }

  if (src.specs !== undefined) out.specs = toObjectSafe(src.specs)
  if (src.details !== undefined) out.details = toObjectSafe(src.details)
  if (src.colors !== undefined) out.colors = toArraySafe(src.colors)

  if (src.discount !== undefined) out.discount = toNumberSafe(src.discount, 0)
  else if (src.sale_price !== undefined) out.sale_price = toNumberSafe(src.sale_price, null)
  else if (src.salePrice !== undefined) out.sale_price = toNumberSafe(src.salePrice, null)

  return removeUndefined(out)
}

export function buildProductPayload(input: any, mode: 'create' | 'update' = 'update'): Record<string, any> {
  const out = normalizeProductPayload(input)

  if (mode === 'create') {
    if (!cleanString(out.title)) throw new Error('Product name is required')
    if (out.price === null || out.price === undefined) throw new Error('Product price is required')
    if (!cleanString(out.category)) throw new Error('Product category is required')

    out.description = cleanString(out.description) || DEFAULT_DESCRIPTION
    out.stock = out.stock === null || out.stock === undefined ? 0 : out.stock
    out.images = Array.isArray(out.images) ? out.images : []
    out.status = out.status || 'published'
  }

  if (out.description !== undefined) out.description = cleanString(out.description) || DEFAULT_DESCRIPTION
  if (!out.slug && out.title) out.slug = slugify(out.title)

  return removeUndefined(out)
}

export function formatProduct(product: any): Record<string, any> {
  const raw = typeof product?.toObject === 'function' ? product.toObject() : { ...(product || {}) }
  const mongoId = raw._id ? String(raw._id) : undefined
  const externalId = raw.id && String(raw.id) !== mongoId ? String(raw.id) : undefined
  const id = mongoId || raw.id
  const title = cleanString(raw.title || raw.name)
  const name = cleanString(raw.name || raw.title)
  const images = Array.isArray(raw.images) ? raw.images : toArraySafe(raw.images)

  return {
    ...raw,
    id,
    external_id: raw.external_id || externalId,
    _id: undefined,
    name,
    title,
    category_id: cleanString(raw.category_id || raw.category),
    category: cleanString(raw.category || raw.category_id),
    brand_id: cleanString(raw.brand_id || raw.brand),
    collection_id: cleanString(raw.collection_id),
    homepage_sections: toStringList(raw.homepage_sections),
    isFeatured: Boolean(raw.isFeatured ?? raw.is_featured ?? false),
    images,
    image: raw.image || images[0] || null,
  }
}

export default normalizeProductPayload
