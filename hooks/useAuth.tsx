"use client"
import { useEffect, useState } from 'react'

const TOKEN_KEY = 'phlakesfabrics_auth_token'
const USER_KEY = 'phlakesfabrics_auth_user'
const LEGACY_TOKEN_KEY = 'phlakesfabrics_legacy_auth_token'
const LEGACY_USER_KEY = 'phlakesfabrics_legacy_auth_user'

type AuthUser = Record<string, unknown> & {
  id?: string
  email?: string | null
  role?: string | null
  name?: string | null
}

type ErrorPayload = {
  error?: string
  message?: string
  data?: {
    error?: string
    message?: string
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
  } catch {
    return null
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredAuth(token: string | null, user: AuthUser | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.removeItem(LEGACY_TOKEN_KEY)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(LEGACY_TOKEN_KEY)
    }

    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      localStorage.removeItem(LEGACY_USER_KEY)
    } else {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(LEGACY_USER_KEY)
    }
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

async function readJsonBody(res: Response) {
  const raw = await res.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return { _raw: raw }
  }
}

function getErrorMessage(payload: ErrorPayload | null | undefined, fallback = 'Invalid email or password') {
  return (
    payload?.error ||
    payload?.message ||
    payload?.data?.error ||
    payload?.data?.message ||
    fallback
  )
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const storedToken = readStoredToken()
        const storedUser = readStoredUser()

        if (storedToken && mounted) setToken(storedToken)
        if (storedUser && mounted) setUser(storedUser)

        const headers: HeadersInit = {}
        if (storedToken) {
          headers.Authorization = `Bearer ${storedToken}`
        }

        const res = await fetch('/api/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers,
        })
        const json = await readJsonBody(res)

        if (!res.ok || !json?.success) {
          if (storedToken) writeStoredAuth(null, null)
          if (!mounted) return
          setToken(null)
          setUser(null)
          return
        }

        const nextUser = json?.data?.user || json?.data?.profile || null
        if (!mounted) return

        setUser(nextUser)
        setToken(storedToken || null)
        if (storedToken) writeStoredAuth(storedToken, nextUser)
      } catch {
        if (!mounted) return
        setToken(readStoredToken())
        setUser(readStoredUser())
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()
    return () => {
      mounted = false
    }
  }, [])

  async function signIn(email?: string, password?: string) {
    const loginEmail = String(email || '').trim().toLowerCase()
    const loginPassword = String(password || '')

    if (!loginEmail || !loginPassword) {
      throw new Error('Email and password are required')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const json = await readJsonBody(res)

      if (!res.ok || !json?.success) {
        throw new Error(getErrorMessage(json))
      }

      const nextUser = json?.data?.user || null
      const nextToken = json?.data?.token || null

      writeStoredAuth(nextToken, nextUser)
      setToken(nextToken)
      setUser(nextUser)

      return { ok: true, user: nextUser, token: nextToken }
      } catch (err: unknown) {
        throw new Error(err instanceof Error ? err.message : 'Invalid email or password')
      } finally {
        setLoading(false)
      }
  }

  async function signOut(redirectTo = '/login') {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => null)
    } finally {
      writeStoredAuth(null, null)
      setToken(null)
      setUser(null)
      setLoading(false)

      if (redirectTo && typeof window !== 'undefined') {
        window.location.href = redirectTo
      }
    }

    return { ok: true }
  }

  return {
    user,
    loading,
    token,
    signIn,
    signOut,
  }
}

export default useAuth
