'use client'

import { useState, useEffect, useCallback } from 'react'
import { SavedProperty, ScorecardResult, PropertyData } from './types'

const STORAGE_KEY = 'pa_saved_properties'
const MAX_SAVED = 3

export function useSavedProperties() {
  const [saved, setSaved] = useState<SavedProperty[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch {}
  }, [])

  function persist(next: SavedProperty[]) {
    setSaved(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const add = useCallback((item: { label: string; result: ScorecardResult; propertyData: PropertyData | null }) => {
    setSaved((prev) => {
      if (prev.length >= MAX_SAVED) return prev
      const next: SavedProperty[] = [
        ...prev,
        { ...item, id: Date.now().toString(), savedAt: Date.now() },
      ]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((p) => p.id !== id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSaved([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const rename = useCallback((id: string, newLabel: string) => {
    setSaved((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, label: newLabel } : p)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { saved, add, remove, rename, clear, isFull: saved.length >= MAX_SAVED }
}
