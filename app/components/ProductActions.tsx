"use client"
import { useCart } from '../../hooks/useCart'
import { useWishlist } from '../../hooks/useWishlist'

export default function ProductActions({ product }: { product: any }) {
  const { add } = useCart()
  const { items: wishlist, toggle } = useWishlist()
  const isWish = wishlist.includes(product.id)

  return (
    <div className="mt-4 flex items-center gap-3">
      <button onClick={() => { console.log('ProductActions: add', product.id); add({ id: product.id, name: product.name, price: product.price, qty: 1 }) }} className="bg-blue-600 text-white px-4 py-2 rounded">Add to cart</button>
      <button onClick={() => { console.log('ProductActions: toggle', product.id); toggle(product.id) }} className={`px-3 py-2 rounded border ${isWish ? 'text-red-500' : 'text-gray-700'}`}>
        {isWish ? 'Remove from wishlist' : 'Add to wishlist'}
      </button>
    </div>
  )
}
