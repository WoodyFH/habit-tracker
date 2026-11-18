// Kleine UI-Einstellungen pro Gerät (localStorage). Alles in try/catch: im privaten Modus kann der Zugriff fehlschlagen.
import { useCallback, useState } from 'react'

export type ViewKey = 'cards' | 'week' | 'table'

export interface Prefs {
  view: ViewKey
  categoryIds: string[]
  onlyDue: boolean
  showArchived: boolean
  weekDays: 5 | 6 | 7
  tableMode: 'days' | 'weeks'
}

const KEY = 'habit-tracker-prefs'

function defaults(): Prefs {
  const wide = typeof window !== 'undefined' && window.innerWidth >= 480
  return { view: 'cards', categoryIds: [], onlyDue: false, showArchived: false, weekDays: wide ? 7 : 5, tableMode: 'days' }
}

function load(): Prefs {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    return { ...base, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    return base
  }
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(load)
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignorieren */
      }
      return next
    })
  }, [])
  return [prefs, update]
}
