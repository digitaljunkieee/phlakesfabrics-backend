"use client"
import Header from '../components/Header'
import { useWishlist } from '../../hooks/useWishlist'
import { useEffect, useState } from 'react'

export default function WishlistPage() {
  const { items, toggle } = useWishlist()
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/products')
      const json = await res.json()
      const all = json?.data || []
      setProducts(all.filter((p: any) => items.includes(p.id)))
    }
    load()
  }, [items])

  return (
    <div>
      <Header />
      <main className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Wishlist</h1>
        {products.length === 0 ? <p>Your wishlist is empty</p> : (
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((p) => (
              <li key={p.id} className="border p-3">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-2">₦{p.price}</div>
                <button className="mt-2 text-blue-600" onClick={() => toggle(p.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
