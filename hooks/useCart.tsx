"use client"
import { useEffect, useState, useRef } from 'react'
import { CartItem } from '../types'

const STORAGE_KEY = 'phlakesfabrics_cart'
const LEGACY_STORAGE_KEYS = ['cart', 'phlakesfabrics_legacy_cart']

function readStoredItems() {
  try {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
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

function writeStoredItems(nextItems: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems))
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch (e) {}
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => readStoredItems()) 

  const suppressRef = useRef(false)

  function persist(nextItems: CartItem[]) {
    writeStoredItems(nextItems)
    try { window.dispatchEvent(new CustomEvent('phlakesfabrics_cart_updated')) } catch (e) {}
  }

  useEffect(() => {
    function handler() {
      suppressRef.current = true
      setItems(readStoredItems())
    }
    window.addEventListener('phlakesfabrics_cart_updated', handler)
    return () => window.removeEventListener('phlakesfabrics_cart_updated', handler)
  }, [])

  function add(item: CartItem) {
    setItems((prev) => {
      console.log('useCart.add', item)
      const found = prev.find((p) => p.id === item.id)
      let next: CartItem[]
      if (found) next = prev.map((p) => p.id === item.id ? { ...p, qty: p.qty + item.qty } : p)
      else next = [...prev, item]
      writeStoredItems(next)
      try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_cart_updated')), 0) } catch (e) {}
      return next
    })
  }

  function remove(id: string) {
    console.log('useCart.remove', id)
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id)
      writeStoredItems(next)
      try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_cart_updated')), 0) } catch (e) {}
      return next
    })
  }

  function updateQty(id: string, qty: number) {
    console.log('useCart.updateQty', id, qty)
    setItems((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, qty } : p)
      writeStoredItems(next)
      try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_cart_updated')), 0) } catch (e) {}
      return next
    })
  }

  function clear() {
    setItems(() => {
      const next: CartItem[] = []
      writeStoredItems(next)
      try { setTimeout(() => window.dispatchEvent(new CustomEvent('phlakesfabrics_cart_updated')), 0) } catch (e) {}
      return next
    })
  }

  return { items, add, remove, updateQty, clear }
}
