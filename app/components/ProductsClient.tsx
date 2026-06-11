"use client"
import React, { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard'

type Product = any

function buildQuery(params: Record<string, any>) {
  const qp = new URLSearchParams()
  if (params.q) qp.set('q', params.q)
  if (params.category) qp.set('category', params.category)
  if (params.brand) qp.set('brand', params.brand)
  if (params.min_price) qp.set('min_price', String(params.min_price))
  if (params.max_price) qp.set('max_price', String(params.max_price))
  if (params.rating) qp.set('rating', String(params.rating))
  if (params.page) qp.set('page', String(params.page))
  if (params.limit) qp.set('limit', String(params.limit))
  if (params.sort) qp.set('sort', params.sort)
  return qp.toString()
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [minPrice, setMinPrice] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [rating, setRating] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 24

  const pageRef = React.useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  const categories = useMemo(() => {
    const s = new Set<string>()
    products.forEach((p) => { if (p?.category_id) s.add(p.category_id) })
    return Array.from(s)
  }, [products])

  const brands = useMemo(() => {
    const s = new Set<string>()
    products.forEach((p) => {
      const b = p?.brand || (p?.specs && p.specs.brand)
      if (b) s.add(b)
    })
    return Array.from(s)
  }, [products])

  async function fetchProducts(params: Record<string, any>) {
    setLoading(true)
    try {
      const qs = buildQuery({ ...params, limit })
  const res = await fetch(`/api/products?${qs}`)
  const json = await res.json()
  // debug response and page
  // eslint-disable-next-line no-console
  console.debug('ProductsClient API response:', json)
  // new public API returns { items, pagination: { page, limit, total } }
  const data = json?.items || []
  setProducts(data)
  // Derive total ONLY from pagination.total
  const totalCount = Number(json?.pagination?.total ?? 0)
  // eslint-disable-next-line no-console
  console.debug('ProductsClient derived total:', totalCount)
      setTotal(totalCount)
  // eslint-disable-next-line no-console
  console.debug('ProductsClient current page:', params?.page ?? pageRef.current)
    } catch (e) {
      console.error('ProductsClient: fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  // When any filter changes, reset to page 1 and trigger a fetch.
  // We debounce user input, and use a ref to read current page to avoid
  // duplicate fetches when setPage(1) causes the page effect to run.
  useEffect(() => {
    const t = setTimeout(() => {
      const filters = { q, category, brand, min_price: minPrice || undefined, max_price: maxPrice || undefined, rating: rating || undefined }
      if (pageRef.current !== 1) {
        setPage(1)
      } else {
        fetchProducts({ ...filters, page: 1 })
      }
    }, 350)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, brand, minPrice, maxPrice, rating])

  useEffect(() => {
    fetchProducts({ q, category, brand, min_price: minPrice || undefined, max_price: maxPrice || undefined, rating: rating || undefined, page })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Initial mount: trigger fetch for page 1 via page effect (page defaults to 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <aside className="md:col-span-1">
        <div className="sticky top-20 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Search products..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">All</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Price min</label>
            <input type="number" value={minPrice === '' ? '' : String(minPrice)} onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Price max</label>
            <input type="number" value={maxPrice === '' ? '' : String(maxPrice)} onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Min rating</label>
            <select value={rating === '' ? '' : String(rating)} onChange={(e) => setRating(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded px-3 py-2">
              <option value="">Any</option>
              {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r}+</option>)}
            </select>
          </div>

          <div>
            <button onClick={() => { setQ(''); setCategory(''); setBrand(''); setMinPrice(''); setMaxPrice(''); setRating('') }} className="text-sm text-gray-600">Reset filters</button>
          </div>
        </div>
      </aside>

      <section className="md:col-span-3">
        <div className="mb-4 text-sm text-gray-600">
          {loading ? 'Loading...' : (
            total === 0 ? 'No products found' : `Showing ${products.length} of ${total} products`
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {total > limit && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">Page {page}</div>
            <div className="space-x-2">
              <button disabled={page <= 1} onClick={() => setPage((s) => Math.max(1, s - 1))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
              <button disabled={page * limit >= total} onClick={() => setPage((s) => s + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
