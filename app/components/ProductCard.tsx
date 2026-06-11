"use client"
import Link from 'next/link'
import { Product } from '../../types'
import { useCart } from '../../hooks/useCart'
import { useWishlist } from '../../hooks/useWishlist'

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart()
  const { items: wishlist, toggle } = useWishlist()
  const isWish = wishlist.includes(product.id)

  return (
    <div className="border rounded p-4 flex flex-col h-full">
      <div className="h-40 bg-gray-100 mb-4 flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="object-cover w-full h-full" />
        ) : (
          <span className="text-gray-400">No image</span>
        )}
      </div>
     <h3 className="font-semibold text-lg">{product.title || product.name}</h3>
      <p className="text-sm text-gray-600 mt-1">₦{product.price}</p>
      <div className="mt-auto flex items-center justify-between pt-3">
        <Link href={`/products/${product.id}`} className="text-blue-600">View</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => { console.log('ProductCard: add', product.id); add({ id: product.id, name: product.name, price: product.price, qty: 1 }) }} className="bg-blue-600 text-white px-3 py-1 rounded">Add</button>
          <button onClick={() => { console.log('ProductCard: toggle', product.id); toggle(product.id) }} aria-label="Toggle wishlist" className={`p-2 rounded ${isWish ? 'text-red-500' : 'text-gray-400'}`}>
            {isWish ? '♥' : '♡'}
          </button>
        </div>
      </div>
    </div>
  )
}
