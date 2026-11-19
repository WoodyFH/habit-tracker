// Gesamtübersicht über alle Gewohnheiten (reine Funktion).
import type { HabitContext } from './schedule'
import { todayStatus } from './todayStatus'
import { computeStats, type HabitStats, type StreakUnit } from './streaks'
import type { DateStr, Habit } from './types'

export interface OverallStats {
  habits: number
  dueToday: number
  doneToday: number
  totalCheckins: number
  /** Durchschnitt der 30-Tage-Erfolgsquoten (nur Gewohnheiten mit Daten), in % */
  avgRate30: number | null
  best: { habitId: string; name: string; value: number; unit: StreakUnit } | null
  perHabit: Map<string, HabitStats>
}

export function computeOverall(habits: Habit[], ctxById: Map<string, HabitContext>, today: DateStr): OverallStats {
  const active = habits.filter((h) => !h.archived)
  const perHabit = new Map<string, HabitStats>()
  let totalCheckins = 0
  const rates: number[] = []
  let best: OverallStats['best'] = null

  for (const h of active) {
    const ctx = ctxById.get(h.id)
    if (!ctx) continue
    const s = computeStats(ctx, today)
    perHabit.set(h.id, s)
    totalCheckins += s.total
    if (s.rate30 !== null) rates.push(s.rate30)
    // beste aktuelle Serie – nur Tage vergleichbar; Wochen/Monate zählen entsprechend mehr
    const days = s.unit === 'days' ? s.current : s.unit === 'weeks' ? s.current * 7 : s.current * 30
    const bestDays = best ? (best.unit === 'days' ? best.value : best.unit === 'weeks' ? best.value * 7 : best.value * 30) : 0
    if (s.current > 0 && days > bestDays) best = { habitId: h.id, name: h.name, value: s.current, unit: s.unit }
  }
  // Archivierte ebenfalls mit Statistik versorgen (für die Einzelliste)
  for (const h of habits.filter((x) => x.archived)) {
    const ctx = ctxById.get(h.id)
    if (ctx) perHabit.set(h.id, computeStats(ctx, today))
  }

  // Heute: verpflichtende + erledigte Gewohnheiten (Wochen-/Monatsziele nur, wenn sie heute sein müssen oder erledigt sind)
  const today_ = todayStatus(habits, ctxById, today)
  const dueToday = today_.total
  const doneToday = today_.done

  return {
    habits: active.length,
    dueToday,
    doneToday,
    totalCheckins,
    avgRate30: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    best,
    perHabit,
  }
}
