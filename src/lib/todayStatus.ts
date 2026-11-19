// Status für "heute" über alle Gewohnheiten (Statusbalken oben auf der Karten-Ansicht) – reine Funktion.
//
//  done      heute erledigt
//  required  muss heute erledigt werden (tägliche / Wochentags- / Intervall-Gewohnheiten, Abgewöhnen)
//  optional  Wochen- oder Monatsziel, das heute noch nicht zwingend ist
//
// Ein Wochen-/Monatsziel wird verpflichtend ("weiß"), sobald die Zahl der noch fehlenden Erledigungen
// gleich der Zahl der verbleibenden aktiven Tage im Zeitraum (inklusive heute) ist – dann muss es heute sein.
import { activeDaysIn, periodInfo, todayInfo, type HabitContext } from './schedule'
import type { DateStr, Habit } from './types'

export type SegmentKind = 'done' | 'required' | 'optional'

export interface TodaySegment {
  habitId: string
  color: string
  kind: SegmentKind
}

export interface TodayStatus {
  segments: TodaySegment[]
  /** Zähler "x von y": verpflichtende + bereits erledigte Gewohnheiten */
  total: number
  done: number
  /** Noch offene, aber nicht verpflichtende Wochen-/Monatsgewohnheiten */
  optionalOpen: number
}

/** Muss dieses Wochen-/Monatsziel heute erledigt werden? (fehlende Erledigungen ≥ verbleibende aktive Tage) */
export function mustDoToday(ctx: HabitContext, today: DateStr): boolean {
  const p = periodInfo(ctx, today, today)
  if (p.neutral) return false
  const missing = p.target - p.count
  const remaining = activeDaysIn(ctx, today, p.to)
  return missing > 0 && missing >= remaining
}

export function todayStatus(habits: Habit[], ctxById: Map<string, HabitContext>, today: DateStr): TodayStatus {
  const segments: TodaySegment[] = []
  for (const h of habits) {
    if (h.archived) continue
    const ctx = ctxById.get(h.id)
    if (!ctx) continue
    const info = todayInfo(ctx, today)
    if (!info.dueToday) continue
    let kind: SegmentKind
    if (info.state === 'done') kind = 'done'
    else if (info.progress) kind = mustDoToday(ctx, today) ? 'required' : 'optional'
    else kind = 'required'
    segments.push({ habitId: h.id, color: h.color, kind })
  }
  const done = segments.filter((s) => s.kind === 'done').length
  const required = segments.filter((s) => s.kind === 'required').length
  return { segments, total: done + required, done, optionalOpen: segments.length - done - required }
}
