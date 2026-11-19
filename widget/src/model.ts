// Berechnet aus den Rohdaten von Supabase das, was das Widget anzeigt. Reine Funktion (getestet).
// Nutzt dieselbe Logik wie die App (schedule.ts, todayStatus.ts) – dadurch stimmen Widget und App immer überein.
import { formatShortDE } from '../../src/lib/dates'
import { colorHex } from '../../src/lib/palette'
import { makeContext, todayInfo, type HabitContext } from '../../src/lib/schedule'
import { todayStatus, type SegmentKind } from '../../src/lib/todayStatus'
import type { DateStr, Habit } from '../../src/lib/types'

export interface RawData {
  habits: any[]
  completions: any[]
  pauses: any[]
}

export interface WidgetSegment {
  habitId: string
  name: string
  hex: string
  kind: SegmentKind
}

export interface WidgetModel {
  /** z. B. "Do, 19. Nov" */
  dateLabel: string
  done: number
  total: number
  optionalOpen: number
  segments: WidgetSegment[]
  /** Offene, verpflichtende Gewohnheiten (in App-Reihenfolge) */
  openRequired: WidgetSegment[]
  /** z. B. "Diese Woche: Laufen 1/2" – oder null */
  weekLine: string | null
}

function shorten(name: string, max = 12): string {
  return name.length > max ? name.slice(0, max - 1).trimEnd() + '…' : name
}

export function computeWidgetModel(raw: RawData, today: DateStr): WidgetModel {
  const habits = raw.habits
    .filter((h) => !h.deleted_at && !h.archived)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) as Habit[]

  const completionsBy = new Map<string, any[]>()
  for (const c of raw.completions) {
    const arr = completionsBy.get(c.habit_id) ?? []
    arr.push(c)
    completionsBy.set(c.habit_id, arr)
  }
  const pausesBy = new Map<string, any[]>()
  for (const p of raw.pauses) {
    const arr = pausesBy.get(p.habit_id) ?? []
    arr.push(p)
    pausesBy.set(p.habit_id, arr)
  }

  const ctxById = new Map<string, HabitContext>()
  for (const h of habits) {
    ctxById.set(h.id, makeContext(h, completionsBy.get(h.id) ?? [], pausesBy.get(h.id) ?? []))
  }

  const status = todayStatus(habits, ctxById, today)
  const byId = new Map(habits.map((h) => [h.id, h]))
  const segments: WidgetSegment[] = status.segments.map((s) => ({
    habitId: s.habitId,
    name: byId.get(s.habitId)!.name,
    hex: colorHex(s.color),
    kind: s.kind,
  }))

  // Wochen-/Monatsziele, die noch optional sind: "Laufen 1/2"
  const weekly: string[] = []
  const monthly: string[] = []
  for (const s of segments) {
    if (s.kind !== 'optional') continue
    const info = todayInfo(ctxById.get(s.habitId)!, today)
    if (!info.progress) continue
    const text = `${shorten(s.name)} ${info.progress.count}/${info.progress.target}`
    ;(info.progress.period === 'week' ? weekly : monthly).push(text)
  }
  let weekLine: string | null = null
  if (weekly.length > 0) {
    const shown = weekly.slice(0, 2).join(' · ')
    weekLine = `Diese Woche: ${shown}${weekly.length > 2 ? ' …' : ''}`
  } else if (monthly.length > 0) {
    const shown = monthly.slice(0, 2).join(' · ')
    weekLine = `Diesen Monat: ${shown}${monthly.length > 2 ? ' …' : ''}`
  }

  return {
    dateLabel: formatShortDE(today),
    done: status.done,
    total: status.total,
    optionalOpen: status.optionalOpen,
    segments,
    openRequired: segments.filter((s) => s.kind === 'required'),
    weekLine,
  }
}
