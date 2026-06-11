"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const { signIn, user } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: any) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await signIn(email, password)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
        throw new Error((result as any).error || 'Invalid email or password')
      }
      router.push('/')
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally { setLoading(false) }
  }

  if (user) return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold">You are already signed in</h1>
    </div>
  )

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <form onSubmit={submit} className="max-w-md">
        <label className="block mb-2">Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border p-2 mt-1" />
        </label>
        <label className="block mb-2">Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full border p-2 mt-1" />
        </label>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  )
}
