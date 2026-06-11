"use client"
import Link from 'next/link'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'

export default function Header() {
  const { items } = useCart()
  const { user, signOut } = useAuth()
  const count = Array.isArray(items) ? items.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 0

  return (
    <header className="bg-white shadow p-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">Phlakes Fabrics</Link>
        <nav className="space-x-4 flex items-center">
          <Link href="/products" className="text-gray-700">Products</Link>
          <Link href="/wishlist" className="text-gray-700 ml-4">Wishlist</Link>
          <Link href="/cart" className="text-gray-700 ml-4">Cart ({count})</Link>
          {user ? (
            <button onClick={() => signOut()} className="ml-4 text-sm text-gray-700">Sign out</button>
          ) : (
            <Link href="/login" className="ml-4 text-sm text-gray-700">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
