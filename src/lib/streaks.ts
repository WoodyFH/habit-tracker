// Serien (Streaks) und Statistik – reine Funktionen.
//
// Einheit der Serie richtet sich nach dem Modell:
//   daily / weekdays / every_n_days / Abgewöhnen → Tage
//   times_per_week                                → Wochen (Mo–So)
//   times_per_month                               → Monate
//
// Regeln
//  * Neutrale Tage (nicht fällig, Pause, außerhalb der Laufzeit) überspringen die Serie – sie reißt dadurch nie.
//  * Der heutige Tag bricht eine Serie nie ab, solange er noch erledigt werden kann.
//  * Wochen-/Monatsziel: Ein Zeitraum zählt, wenn das (ggf. wegen Pausen reduzierte) Ziel erreicht ist.
//    Der laufende, noch nicht erreichte Zeitraum bricht die Serie nicht ab.
//  * "Alle N Tage": Jede Erledigung innerhalb von N (wirksamen) Tagen nach der vorigen verlängert die Serie;
//    ist die Lücke größer, beginnt mit dieser Erledigung eine neue Serie.

import { addDays, eachDay, maxDate, minDate } from './dates'
import {
  effectiveGap,
  effectiveScheduleType,
  everyNInterval,
  isDone,
  isPaused,
  isPeriodic,
  isRelapse,
  isScheduledDay,
  nextPeriodStart,
  periodInfo,
  type HabitContext,
} from './schedule'
import type { DateStr } from './types'

export type StreakUnit = 'days' | 'weeks' | 'months'

export interface StreakResult {
  current: number
  longest: number
  unit: StreakUnit
}

export function streakUnit(ctx: HabitContext): StreakUnit {
  const t = effectiveScheduleType(ctx.habit)
  return t === 'times_per_week' ? 'weeks' : t === 'times_per_month' ? 'months' : 'days'
}

/** Letzter Tag, der für Auswertungen zählt: min(heute, Enddatum). */
function evalEnd(ctx: HabitContext, today: DateStr): DateStr {
  return ctx.habit.end_date ? minDate(today, ctx.habit.end_date) : today
}

// ---------------------------------------------------------------------------
// Tage-Serien (täglich / Wochentage)
// ---------------------------------------------------------------------------

function dayBasedStreak(ctx: HabitContext, today: DateStr): { current: number; longest: number } {
  let run = 0
  let longest = 0
  const end = evalEnd(ctx, today)
  if (end < ctx.habit.start_date) return { current: 0, longest: 0 }
  for (const d of eachDay(ctx.habit.start_date, end)) {
    if (isDone(ctx, d)) {
      // Erledigungen an nicht fälligen Tagen (Bonus) verlängern die Serie nicht.
      if (isScheduledDay(ctx, d)) {
        run++
        if (run > longest) longest = run
      }
      continue
    }
    if (!isScheduledDay(ctx, d)) continue // neutral
    if (d === today) continue // heute noch offen → bricht nicht
    run = 0 // fällig und verpasst
  }
  return { current: run, longest }
}

// ---------------------------------------------------------------------------
// Alle N Tage
// ---------------------------------------------------------------------------

export interface Interval {
  /** Tag der Erledigung bzw. erster überfälliger Tag. */
  date: DateStr
  ok: boolean
  /** true = keine Erledigung, sondern die aktuell überfällige Lücke */
  overdue?: boolean
}

/** Bewertet jede Erledigung (rechtzeitig/zu spät) und ggf. die aktuell überfällige Lücke. */
export function everyNIntervals(ctx: HabitContext, today: DateStr): Interval[] {
  const n = everyNInterval(ctx.habit)
  const out: Interval[] = []
  const end = evalEnd(ctx, today)
  let prev = addDays(ctx.habit.start_date, -n)
  for (const c of ctx.doneDates) {
    if (c > end) break
    out.push({ date: c, ok: effectiveGap(ctx, prev, c) <= n })
    prev = c
  }
  if (end >= ctx.habit.start_date && effectiveGap(ctx, prev, end) > n) {
    // ersten überfälligen Tag bestimmen
    let d = addDays(prev, 1)
    while (d <= end && effectiveGap(ctx, prev, d) <= n) d = addDays(d, 1)
    out.push({ date: d, ok: false, overdue: true })
  }
  return out
}

function everyNStreak(ctx: HabitContext, today: DateStr): { current: number; longest: number } {
  const intervals = everyNIntervals(ctx, today)
  let run = 0
  let longest = 0
  let overdue = false
  for (const iv of intervals) {
    if (iv.ok) {
      run++
    } else if (iv.overdue) {
      overdue = true // aktuell überfällig
    } else {
      run = 1 // zu spät, aber diese Erledigung beginnt eine neue Serie
    }
    if (run > longest) longest = run
  }
  return { current: overdue ? 0 : run, longest }
}

// ---------------------------------------------------------------------------
// Wochen-/Monatsziele
// ---------------------------------------------------------------------------

interface PeriodOutcome {
  from: DateStr
  to: DateStr
  met: boolean
  closed: boolean
}

function periodOutcomes(ctx: HabitContext, today: DateStr): PeriodOutcome[] {
  const h = ctx.habit
  const end = evalEnd(ctx, today)
  if (end < h.start_date) return []
  const out: PeriodOutcome[] = []
  let cursor = periodInfo(ctx, h.start_date, today).from
  for (let i = 0; i < 5000 && cursor <= end; i++) {
    const p = periodInfo(ctx, cursor, today)
    if (!p.neutral) out.push({ from: p.from, to: p.to, met: p.met, closed: p.closed })
    cursor = nextPeriodStart(h, cursor)
  }
  return out
}

function periodStreak(ctx: HabitContext, today: DateStr): { current: number; longest: number } {
  let run = 0
  let longest = 0
  for (const p of periodOutcomes(ctx, today)) {
    if (p.met) {
      run++
      if (run > longest) longest = run
    } else if (p.closed) {
      run = 0
    }
    // offen und noch nicht erreicht → überspringen
  }
  return { current: run, longest }
}

// ---------------------------------------------------------------------------
// Abgewöhnen
// ---------------------------------------------------------------------------

export interface QuitSummary {
  current: number
  longest: number
  /** Tage ohne Rückfall (gesamt) */
  cleanDays: number
  relapses: number
  /** Gewertete Tage (ohne Pausen) */
  countedDays: number
}

export function quitSummary(ctx: HabitContext, today: DateStr, window?: { from: DateStr }): QuitSummary {
  const h = ctx.habit
  const end = evalEnd(ctx, today)
  const out: QuitSummary = { current: 0, longest: 0, cleanDays: 0, relapses: 0, countedDays: 0 }
  if (end < h.start_date) return out
  let run = 0
  for (const d of eachDay(h.start_date, end)) {
    if (isPaused(ctx, d)) continue
    const inWindow = !window || d >= window.from
    if (isRelapse(ctx, d)) {
      run = 0
      if (inWindow) {
        out.relapses++
        out.countedDays++
      }
    } else {
      run++
      if (run > out.longest) out.longest = run
      if (inWindow) {
        out.cleanDays++
        out.countedDays++
      }
    }
  }
  out.current = run
  return out
}

// ---------------------------------------------------------------------------
// Öffentliche API: Serien
// ---------------------------------------------------------------------------

export function computeStreaks(ctx: HabitContext, today: DateStr): StreakResult {
  const unit = streakUnit(ctx)
  if (ctx.habit.type === 'quit') {
    const q = quitSummary(ctx, today)
    return { current: q.current, longest: q.longest, unit }
  }
  const t = effectiveScheduleType(ctx.habit)
  const r =
    t === 'every_n_days'
      ? everyNStreak(ctx, today)
      : isPeriodic(ctx.habit)
        ? periodStreak(ctx, today)
        : dayBasedStreak(ctx, today)
  return { ...r, unit }
}

// ---------------------------------------------------------------------------
// Erfolgsquote
// ---------------------------------------------------------------------------

/** Quote in Prozent (0–100) im Zeitfenster [from, heute]; null, wenn es noch nichts zu bewerten gibt. */
export function successRate(ctx: HabitContext, today: DateStr, from?: DateStr): number | null {
  const h = ctx.habit
  const end = evalEnd(ctx, today)
  const start = from ? maxDate(from, h.start_date) : h.start_date
  if (end < start) return null

  if (h.type === 'quit') {
    const q = quitSummary(ctx, today, { from: start })
    return q.countedDays === 0 ? null : Math.round((q.cleanDays / q.countedDays) * 100)
  }

  const t = effectiveScheduleType(h)

  if (t === 'every_n_days') {
    const ivs = everyNIntervals(ctx, today).filter((i) => i.date >= start)
    if (ivs.length === 0) return null
    return Math.round((ivs.filter((i) => i.ok).length / ivs.length) * 100)
  }

  if (isPeriodic(h)) {
    const outcomes = periodOutcomes(ctx, today).filter((p) => p.to >= start && (p.closed || p.met))
    if (outcomes.length === 0) return null
    return Math.round((outcomes.filter((p) => p.met).length / outcomes.length) * 100)
  }

  // daily / weekdays: fällige Tage; heute zählt nur, wenn schon erledigt.
  let opportunities = 0
  let done = 0
  for (const d of eachDay(start, end)) {
    if (!isScheduledDay(ctx, d)) continue
    if (isDone(ctx, d)) {
      opportunities++
      done++
    } else if (d !== today) {
      opportunities++
    }
  }
  return opportunities === 0 ? null : Math.round((done / opportunities) * 100)
}

// ---------------------------------------------------------------------------
// Statistik pro Gewohnheit
// ---------------------------------------------------------------------------

export interface HabitStats extends StreakResult {
  rate30: number | null
  rateTotal: number | null
  /** Gesamtanzahl: erledigte Tage (Aufbauen) bzw. Tage ohne Rückfall (Abgewöhnen). */
  total: number
  /** Nur Abgewöhnen: Anzahl Rückfälle. */
  relapses: number
}

export function computeStats(ctx: HabitContext, today: DateStr): HabitStats {
  const streaks = computeStreaks(ctx, today)
  const from30 = addDays(today, -29)
  let total: number
  let relapses = 0
  if (ctx.habit.type === 'quit') {
    const q = quitSummary(ctx, today)
    total = q.cleanDays
    relapses = q.relapses
  } else {
    total = ctx.doneDates.length
  }
  return {
    ...streaks,
    rate30: successRate(ctx, today, from30),
    rateTotal: successRate(ctx, today),
    total,
    relapses,
  }
}
