/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client"
import { useEffect, useState, useRef } from 'react'
import { useAuth } from './useAuth'

const KEY = 'phlakesfabrics_wishlist'
const LEGACY_KEYS = ['phlakesfabrics_legacy_wishlist']

function readStoredWishlist() {
  try {
    for (const key of [KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    return []
  }

  return []
}

function writeStoredWishlist(items: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch (e) {}
}

export function useWishlist() {
  const { token } = useAuth()
  const [items, setItems] = useState<string[]>(() => readStoredWishlist())
  const [entryMap, setEntryMap] = useState<Record<string, string>>({})

  const suppressRef = useRef(false)

  async function reload() {
    if (token) {
      try {
        console.debug('useWishlist: fetching /api/me/wishlist with token', token?.slice?.(0, 10) + '...')
        const res = await fetch('/api/me/wishlist', { headers: { Authorization: `Bearer ${token}` } })
        const raw = await res.text()
        let json: any = {}
        try { json = raw ? JSON.parse(raw) : {} } catch (e) { json = { _raw: raw } }
        if (!res.ok) {
          console.error('useWishlist: GET /api/me/wishlist failed', { status: res.status, body: json, raw })
          return
        }
        if (json?.success) {
          const data = json.data || []
          const pids = data.map((d: any) => d.product_id)
          const map: Record<string, string> = {}
          data.forEach((d: any) => { if (d.product_id) map[d.product_id] = d.id })
          setItems(pids)
          setEntryMap(map)
          return
        }
      } catch (e) {
        console.error('useWishlist reload error:', e)
      }
    }

    setItems(readStoredWishlist())
  }

  useEffect(() => { void reload() }, [token])

  useEffect(() => {
    const handler = () => {
      if (!token) suppressRef.current = true
      void reload()
    }
    window.addEventListener('phlakesfabrics_wishlist_updated', handler)
    return () => window.removeEventListener('phlakesfabrics_wishlist_updated', handler)
  }, [token])

  useEffect(() => { if (!token) writeStoredWishlist(items) }, [items, token])

  async function toggle(id: string) {
    if (token) {
      const isPresent = !!entryMap[id]

      if (isPresent) {
        const prevItems = items
        const prevMap = entryMap
        let entryId = prevMap[id]
        if (!entryId || entryId === 'undefined') {
          try {
            const chk = await fetch(`/api/me/wishlist/check?product_id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
            const rawc = await chk.text()
            let jc: any = {}
            try { jc = rawc ? JSON.parse(rawc) : {} } catch (e) { jc = { _raw: rawc } }
            if (!chk.ok) {
              console.error('useWishlist: check endpoint failed', { status: chk.status, body: jc, raw: rawc })
              setItems(prevItems)
              setEntryMap(prevMap)
              return
            }
            if (jc?.success && jc?.present && jc?.id) {
              entryId = jc.id
            } else if (jc?.success && !jc?.present) {
              setItems(prevItems)
              setEntryMap(prevMap)
              return
            } else {
              console.error('useWishlist: unexpected check response', jc)
              setItems(prevItems)
              setEntryMap(prevMap)
              return
            }
          } catch (e) {
            console.error('useWishlist: failed to resolve wishlist entry id via check endpoint', e)
            setItems(prevItems)
            setEntryMap(prevMap)
            return
          }
        }
  setItems((prev) => prev.filter((x) => x !== id))
        setEntryMap((m) => { const nm = { ...m }; delete nm[id]; return nm })
        try {
          const res = await fetch(`/api/me/wishlist/${entryId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          const raw = await res.text()
          let json: any = {}
          try { json = raw ? JSON.parse(raw) : {} } catch (e) { json = { _raw: raw } }
          if (!res.ok) {
            console.error('useWishlist: DELETE failed', { status: res.status, body: json, raw })
            setItems(prevItems)
            setEntryMap(prevMap)
            return
          }
          try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_wishlist_updated')), 0) } catch (e) {}
        } catch (e) {
          console.error('Failed to remove wishlist', e)
          setItems(prevItems)
          setEntryMap(prevMap)
        }

        return
      }

      const prevItems = items
      const prevMap = entryMap
      setItems((prev) => [...prev, id])
      try {
        const res = await fetch('/api/me/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ product_id: id }) })
        const raw = await res.text()
        let json: any = {}
        try { json = raw ? JSON.parse(raw) : {} } catch (e) { json = { _raw: raw } }
        if (!res.ok) {
          console.error('useWishlist: POST /api/me/wishlist failed', { status: res.status, body: json, raw })
          setItems(prevItems)
          setEntryMap(prevMap)
          return
        }
        if (json?.success) {
          let newId = null
          if (Array.isArray(json.data) && json.data[0]) newId = json.data[0].id
          else if (json.data && json.data.id) newId = json.data.id
          if (newId) setEntryMap((m) => ({ ...m, [id]: newId }))
          try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_wishlist_updated')), 0) } catch (e) {}
        }
      } catch (e) {
        console.error('Failed to add wishlist', e)
        setItems(prevItems)
        setEntryMap(prevMap)
      }

      return
    }

    setItems((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function clear() { setItems([]); if (!token) writeStoredWishlist([]) }

  useEffect(() => {
    if (!token) {
      writeStoredWishlist(items)
      if (suppressRef.current) {
        suppressRef.current = false
        return
      }
      try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_wishlist_updated')), 0) } catch (e) {}
    }
  }, [items, token])

  return { items, toggle, clear }
}
