// Stellt alle lokalen Daten (live aus IndexedDB) und die abgeleiteten Berechnungen für die UI bereit.
import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from './db'
import { todayStr } from './dates'
import { makeContext, type HabitContext } from './schedule'
import type { Category, Completion, DateStr, Habit, Local, Pause } from './types'

export interface DataModel {
  ready: boolean
  today: DateStr
  /** Nicht gelöschte Gewohnheiten, nach sort_order. */
  habits: Habit[]
  categories: Category[]
  /** habit_id → category_ids */
  categoryIdsByHabit: Map<string, string[]>
  completionsByHabit: Map<string, Map<DateStr, Completion>>
  pausesByHabit: Map<string, Pause[]>
  ctxById: Map<string, HabitContext>
}

const Ctx = createContext<DataModel | null>(null)

export function useData(): DataModel {
  const v = useContext(Ctx)
  if (!v) throw new Error('DataProvider fehlt')
  return v
}

/** Aktuelles Datum (Europe/Vienna); aktualisiert sich nach Mitternacht und beim Zurückkehren in die App. */
export function useToday(): DateStr {
  const [today, setToday] = useState(() => todayStr())
  useEffect(() => {
    const refresh = () => setToday((t) => {
      const n = todayStr()
      return n === t ? t : n
    })
    const id = setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return today
}

export function DataProvider({ children }: { children: ReactNode }) {
  const today = useToday()
  const snap = useLiveQuery(async () => {
    const [habits, categories, links, completions, pauses] = await Promise.all([
      db.habits.toArray(),
      db.categories.toArray(),
      db.habit_categories.toArray(),
      db.completions.toArray(),
      db.pauses.toArray(),
    ])
    return { habits, categories, links, completions, pauses }
  }, [])

  const model = useMemo<DataModel>(() => {
    if (!snap) {
      return {
        ready: false,
        today,
        habits: [],
        categories: [],
        categoryIdsByHabit: new Map(),
        completionsByHabit: new Map(),
        pausesByHabit: new Map(),
        ctxById: new Map(),
      }
    }
    const strip = <T extends object>(r: Local<T>): T => {
      const { _dirty: _d, ...rest } = r as Local<T> & { _dirty?: unknown }
      return rest as unknown as T
    }
    const habits = snap.habits
      .filter((h) => !h.deleted_at)
      .map(strip<Habit>)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    const categories = snap.categories
      .filter((c) => !c.deleted_at)
      .map(strip<Category>)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'de'))
    const liveCats = new Set(categories.map((c) => c.id))

    const categoryIdsByHabit = new Map<string, string[]>()
    for (const l of snap.links) {
      if (l.deleted_at || !liveCats.has(l.category_id)) continue
      const arr = categoryIdsByHabit.get(l.habit_id) ?? []
      arr.push(l.category_id)
      categoryIdsByHabit.set(l.habit_id, arr)
    }

    const completionsByHabit = new Map<string, Map<DateStr, Completion>>()
    for (const c of snap.completions) {
      if (c.deleted_at) continue
      let m = completionsByHabit.get(c.habit_id)
      if (!m) completionsByHabit.set(c.habit_id, (m = new Map()))
      m.set(c.date, strip<Completion>(c))
    }

    const pausesByHabit = new Map<string, Pause[]>()
    for (const p of snap.pauses) {
      if (p.deleted_at) continue
      const arr = pausesByHabit.get(p.habit_id) ?? []
      arr.push(strip<Pause>(p))
      pausesByHabit.set(p.habit_id, arr)
    }
    for (const arr of pausesByHabit.values()) arr.sort((a, b) => a.from_date.localeCompare(b.from_date))

    const ctxById = new Map<string, HabitContext>()
    for (const h of habits) {
      const comps = completionsByHabit.get(h.id)
      const ps = pausesByHabit.get(h.id) ?? []
      ctxById.set(
        h.id,
        makeContext(h, comps ? [...comps.values()] : [], ps.map((p) => ({ from_date: p.from_date, to_date: p.to_date, deleted_at: null }))),
      )
    }
    return { ready: true, today, habits, categories, categoryIdsByHabit, completionsByHabit, pausesByHabit, ctxById }
  }, [snap, today])

  return <Ctx.Provider value={model}>{children}</Ctx.Provider>
}
