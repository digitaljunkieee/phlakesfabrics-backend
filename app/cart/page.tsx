"use client"
import Header from '../components/Header'
import { useCart } from '../../hooks/useCart'
import Link from 'next/link'

export default function CartPage() {
  const { items, remove, updateQty, clear } = useCart()

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)

  return (
    <div>
      <Header />
      <main className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Your cart</h1>
        {items.length === 0 ? (
          <p>Your cart is empty. <Link href="/products" className="text-blue-600">Shop now</Link></p>
        ) : (
          <div>
            <ul className="space-y-4">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between border p-3">
                  <div>
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-sm text-gray-600">₦{it.price}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className="w-16 border p-1" type="number" value={it.qty} min={1} onChange={(e) => updateQty(it.id, Number(e.target.value))} />
                    <button className="text-red-600" onClick={() => remove(it.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <div className="font-semibold">Subtotal: ₦{subtotal}</div>
              <div className="mt-2">
                <Link href="/checkout" className="bg-green-600 text-white px-4 py-2 rounded">Checkout</Link>
                <button onClick={() => clear()} className="ml-3 text-sm text-gray-600">Clear</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
