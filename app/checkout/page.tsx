"use client"
import { useState } from 'react'
import Header from '../components/Header'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function CheckoutPage() {
  const { items, clear } = useCart()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)

  async function handleCheckout(e: any) {
    e.preventDefault()
    setLoading(true)
    const payload = { items, email: user?.email || 'guest@phlakesfabrics.test', shipping_address: {} }
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    setLoading(false)
    if (json.success && json.data?.paystack?.authorization_url) {
      clear()
      window.location.href = json.data.paystack.authorization_url
    } else {
      const details = json.details ? ` - ${JSON.stringify(json.details)}` : ''
      alert('Checkout failed: ' + (json.error || 'Unknown') + details)
    }
  }

  return (
    <div>
      <Header />
      <main className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <div>Subtotal: ₦{subtotal}</div>
        <form onSubmit={handleCheckout} className="mt-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading || items.length===0}>{loading ? 'Processing...' : 'Pay with Paystack'}</button>
        </form>
      </main>
    </div>
  )
}
