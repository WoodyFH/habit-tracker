// Fälligkeitslogik: reine Funktionen ohne Seiteneffekte (kein Datum "jetzt", kein DB-Zugriff).
// Alle Datumswerte sind lokale Kalendertage "YYYY-MM-DD"; "today" wird immer übergeben.
//
// Modelle (schedule_type)
//  daily            jeden Tag
//  weekdays         bestimmte Wochentage (config.weekdays, 1 = Mo … 7 = So)
//  times_per_week   X-mal pro Woche an beliebigen Tagen (Woche = Mo–So)
//  times_per_month  X-mal pro Monat an beliebigen Tagen (Kalendermonat)
//  every_n_days     alle N Tage: fällig, sobald seit der letzten Erledigung N Tage vergangen sind
//
// Gemeinsame Regeln
//  * Pausen: Tage in einer Pause sind neutral – nicht fällig, zählen nicht als verpasst, Serie reißt nicht.
//  * Außerhalb von start_date … end_date ist alles neutral.
//  * Abgewöhnen (type "quit"): jeder Tag gilt als gelungen, solange kein Rückfall eingetragen ist.
//    Ein Eintrag (completion) bedeutet hier "Rückfall". Wiederholung ist immer "täglich".

import {
  addDays,
  addMonthsToFirst,
  compareDates,
  diffDays,
  endOfMonth,
  endOfWeek,
  isoWeekday,
  maxDate,
  minDate,
  startOfMonth,
  startOfWeek,
  WEEKDAY_SHORT,
} from './dates'
import type { Completion, DateRange, DateStr, HabitLogic, Pause } from './types'

// ---------------------------------------------------------------------------
// Kontext
// ---------------------------------------------------------------------------

export interface HabitContext {
  habit: HabitLogic
  /** Datum → Wert (nur nicht gelöschte Einträge). */
  values: ReadonlyMap<DateStr, number>
  /** Zusammengeführte, sortierte, überlappungsfreie Pausen. */
  pauses: readonly DateRange[]
  /** Sortierte Tage, die als "erledigt" gelten (nur Aufbauen-Gewohnheiten, ab start_date, bis end_date). */
  doneDates: readonly DateStr[]
}

export function mergeRanges(ranges: readonly DateRange[]): DateRange[] {
  const sorted = ranges
    .filter((r) => r.to >= r.from)
    .map((r) => ({ ...r }))
    .sort((a, b) => compareDates(a.from, b.from))
  const out: DateRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.from <= addDays(last.to, 1)) {
      if (r.to > last.to) last.to = r.to
    } else out.push(r)
  }
  return out
}

/** Zielwert eines Zählers (mindestens 1). */
export function counterTarget(habit: Pick<HabitLogic, 'tracking_mode' | 'target_value'>): number {
  if (habit.tracking_mode !== 'counter') return 1
  const t = habit.target_value ?? 1
  return t >= 1 ? t : 1
}

/** Zählt ein Eintrag mit diesem Wert als "erledigt"? */
export function isDoneValue(habit: Pick<HabitLogic, 'tracking_mode' | 'target_value'>, value: number | undefined): boolean {
  if (value === undefined || !(value > 0)) return false
  if (habit.tracking_mode === 'counter') return value >= counterTarget(habit)
  return true
}

export function makeContext(
  habit: HabitLogic,
  entries: ReadonlyArray<Pick<Completion, 'date' | 'value' | 'deleted_at'>>,
  pauses: ReadonlyArray<Pick<Pause, 'from_date' | 'to_date' | 'deleted_at'>> = [],
): HabitContext {
  const values = new Map<DateStr, number>()
  for (const e of entries) {
    if (e.deleted_at) continue
    values.set(e.date, e.value)
  }
  const doneDates: DateStr[] = []
  if (habit.type === 'build') {
    for (const [date, value] of values) {
      if (date < habit.start_date) continue
      if (habit.end_date && date > habit.end_date) continue
      if (isDoneValue(habit, value)) doneDates.push(date)
    }
    doneDates.sort(compareDates)
  }
  const merged = mergeRanges(pauses.filter((p) => !p.deleted_at).map((p) => ({ from: p.from_date, to: p.to_date })))
  return { habit, values, pauses: merged, doneDates }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

export function isPaused(ctx: HabitContext, date: DateStr): boolean {
  for (const p of ctx.pauses) {
    if (date >= p.from && date <= p.to) return true
    if (p.from > date) break
  }
  return false
}

/** Anzahl pausierter Tage in [from, to] (inklusive). */
export function pausedDaysIn(ctx: HabitContext, from: DateStr, to: DateStr): number {
  if (to < from) return 0
  let n = 0
  for (const p of ctx.pauses) {
    const a = maxDate(p.from, from)
    const b = minDate(p.to, to)
    if (b >= a) n += diffDays(a, b) + 1
  }
  return n
}

/** Liegt der Tag zwischen Start- und Enddatum? */
export function isWithinLifespan(habit: HabitLogic, date: DateStr): boolean {
  return date >= habit.start_date && (!habit.end_date || date <= habit.end_date)
}

/** Aktiv = innerhalb von Start/Ende und nicht pausiert. */
export function isActiveDate(ctx: HabitContext, date: DateStr): boolean {
  return isWithinLifespan(ctx.habit, date) && !isPaused(ctx, date)
}

/** Anzahl aktiver Tage in [from, to], auf Lebensdauer der Gewohnheit zugeschnitten. */
export function activeDaysIn(ctx: HabitContext, from: DateStr, to: DateStr): number {
  const a = maxDate(from, ctx.habit.start_date)
  const b = ctx.habit.end_date ? minDate(to, ctx.habit.end_date) : to
  if (b < a) return 0
  return diffDays(a, b) + 1 - pausedDaysIn(ctx, a, b)
}

function lowerBound(arr: readonly string[], x: string): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Anzahl erledigter Tage in [from, to] (inklusive). */
export function countDoneIn(ctx: HabitContext, from: DateStr, to: DateStr): number {
  if (to < from) return 0
  return lowerBound(ctx.doneDates, addDays(to, 1)) - lowerBound(ctx.doneDates, from)
}

export function isDone(ctx: HabitContext, date: DateStr): boolean {
  if (ctx.habit.type !== 'build') return false
  return isDoneValue(ctx.habit, ctx.values.get(date))
}

/** Abgewöhnen: Ist an diesem Tag ein Rückfall eingetragen? */
export function isRelapse(ctx: HabitContext, date: DateStr): boolean {
  return ctx.habit.type === 'quit' && (ctx.values.get(date) ?? 0) > 0
}

/** Der effektive Schedule-Typ (Abgewöhnen ist immer "täglich"). */
export function effectiveScheduleType(habit: HabitLogic) {
  return habit.type === 'quit' ? 'daily' : habit.schedule_type
}

export function everyNInterval(habit: HabitLogic): number {
  const n = Math.floor(habit.schedule_config?.interval ?? 1)
  return n >= 1 ? n : 1
}

export function timesTarget(habit: HabitLogic): number {
  const n = Math.floor(habit.schedule_config?.times ?? 1)
  return n >= 1 ? n : 1
}

export function scheduledWeekdays(habit: HabitLogic): number[] {
  return (habit.schedule_config?.weekdays ?? []).filter((d) => d >= 1 && d <= 7)
}

// ---------------------------------------------------------------------------
// "Alle N Tage"
// ---------------------------------------------------------------------------

/** Wirksamer Abstand in Tagen von `from` bis `to`, ohne pausierte Tage. */
export function effectiveGap(ctx: HabitContext, from: DateStr, to: DateStr): number {
  return diffDays(from, to) - pausedDaysIn(ctx, addDays(from, 1), to)
}

/** Letzter erledigter Tag vor `date` – oder der virtuelle Anker (start_date − N), damit der Starttag fällig ist. */
export function previousAnchor(ctx: HabitContext, date: DateStr): DateStr {
  const idx = lowerBound(ctx.doneDates, date) - 1
  if (idx >= 0) return ctx.doneDates[idx]
  return addDays(ctx.habit.start_date, -everyNInterval(ctx.habit))
}

export function isEveryNDue(ctx: HabitContext, date: DateStr): boolean {
  if (!isActiveDate(ctx, date)) return false
  return effectiveGap(ctx, previousAnchor(ctx, date), date) >= everyNInterval(ctx.habit)
}

// ---------------------------------------------------------------------------
// Wochen-/Monatsziele
// ---------------------------------------------------------------------------

export interface PeriodInfo {
  /** Ungekürzter Zeitraum (Montag–Sonntag bzw. Monatserster–Monatsletzter). */
  from: DateStr
  to: DateStr
  /** Aktive (nicht pausierte, innerhalb der Lebensdauer liegende) Tage im Zeitraum. */
  activeDays: number
  /** Wirksames Ziel = min(Soll, aktive Tage). */
  target: number
  count: number
  /** Zeitraum ist vorbei (oder die Gewohnheit endete darin) – er kann nicht mehr verändert werden. */
  closed: boolean
  met: boolean
  /** Kein aktiver Tag im Zeitraum → wird übersprungen (weder Erfolg noch Misserfolg). */
  neutral: boolean
}

export function isPeriodic(habit: HabitLogic): boolean {
  const t = effectiveScheduleType(habit)
  return t === 'times_per_week' || t === 'times_per_month'
}

export function periodRange(habit: HabitLogic, date: DateStr): DateRange {
  return effectiveScheduleType(habit) === 'times_per_month'
    ? { from: startOfMonth(date), to: endOfMonth(date) }
    : { from: startOfWeek(date), to: endOfWeek(date) }
}

export function nextPeriodStart(habit: HabitLogic, from: DateStr): DateStr {
  return effectiveScheduleType(habit) === 'times_per_month' ? addMonthsToFirst(from, 1) : addDays(from, 7)
}

export function periodInfo(ctx: HabitContext, date: DateStr, today: DateStr): PeriodInfo {
  const h = ctx.habit
  const { from, to } = periodRange(h, date)
  const clipFrom = maxDate(from, h.start_date)
  const clipTo = h.end_date ? minDate(to, h.end_date) : to
  const activeDays = activeDaysIn(ctx, from, to)
  const target = Math.min(timesTarget(h), activeDays)
  const count = countDoneIn(ctx, clipFrom, clipTo)
  const neutral = activeDays === 0
  return {
    from,
    to,
    activeDays,
    target,
    count,
    closed: clipTo < today,
    met: !neutral && count >= target,
    neutral,
  }
}

// ---------------------------------------------------------------------------
// Status pro Tag
// ---------------------------------------------------------------------------

export type DayStatus =
  | 'done' //     erledigt (bzw. beim Abgewöhnen: sauber)
  | 'partial' //  Zähler: etwas, aber noch nicht das Tagesziel
  | 'missed' //   fällig gewesen und nicht erledigt (bzw. Rückfall)
  | 'open' //     heute fällig / bei Wochen- und Monatszielen noch möglich
  | 'neutral' //  laut Plan nicht fällig, pausiert oder außerhalb der Laufzeit – zählt nie als verpasst
  | 'future'

export function isScheduledDay(ctx: HabitContext, date: DateStr): boolean {
  const h = ctx.habit
  if (!isActiveDate(ctx, date)) return false
  switch (effectiveScheduleType(h)) {
    case 'daily':
      return true
    case 'weekdays':
      return scheduledWeekdays(h).includes(isoWeekday(date))
    case 'every_n_days':
      return isEveryNDue(ctx, date)
    case 'times_per_week':
    case 'times_per_month':
      return true // beliebiger Tag möglich
  }
}

export function dayStatus(ctx: HabitContext, date: DateStr, today: DateStr): DayStatus {
  const h = ctx.habit
  if (date > today) return 'future'
  if (!isWithinLifespan(h, date)) return 'neutral'

  if (h.type === 'quit') {
    if (isPaused(ctx, date)) return 'neutral'
    return isRelapse(ctx, date) ? 'missed' : 'done'
  }

  if (isDone(ctx, date)) return 'done'
  const value = ctx.values.get(date) ?? 0
  if (value > 0 && h.tracking_mode === 'counter') return 'partial'
  if (isPaused(ctx, date)) return 'neutral'

  switch (effectiveScheduleType(h)) {
    case 'daily':
      return date === today ? 'open' : 'missed'
    case 'weekdays':
      if (!scheduledWeekdays(h).includes(isoWeekday(date))) return 'neutral'
      return date === today ? 'open' : 'missed'
    case 'every_n_days':
      if (!isEveryNDue(ctx, date)) return 'neutral'
      return date === today ? 'open' : 'missed'
    case 'times_per_week':
    case 'times_per_month':
      return 'open'
  }
}

// ---------------------------------------------------------------------------
// Status für "heute" (Karten, Filter "nur heute fällige")
// ---------------------------------------------------------------------------

export type TodayState =
  | 'done'
  | 'partial'
  | 'due' //        heute fällig, noch offen
  | 'open' //       Wochen-/Monatsziel noch nicht erreicht (heute möglich)
  | 'rest' //       heute nicht fällig / Ziel für den Zeitraum schon erreicht
  | 'relapse' //    Abgewöhnen: heute Rückfall
  | 'paused'
  | 'notstarted'
  | 'ended'

export interface TodayInfo {
  state: TodayState
  /** Gehört zu "heute fällig" (auch wenn schon erledigt, damit die Tagesliste vollständig bleibt). */
  dueToday: boolean
  /** Bei Wochen-/Monatszielen: Fortschritt im aktuellen Zeitraum. */
  progress: { count: number; target: number; period: 'week' | 'month' } | null
  label: string
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function progressLabel(p: { count: number; target: number; period: 'week' | 'month' }): string {
  return `${p.count} von ${p.target} ${p.period === 'week' ? 'diese Woche' : 'diesen Monat'}`
}

export function todayInfo(ctx: HabitContext, today: DateStr): TodayInfo {
  const h = ctx.habit
  const type = effectiveScheduleType(h)

  if (today < h.start_date) {
    return { state: 'notstarted', dueToday: false, progress: null, label: 'Startet bald' }
  }
  if (h.end_date && today > h.end_date) {
    return { state: 'ended', dueToday: false, progress: null, label: 'Beendet' }
  }

  if (h.type === 'quit') {
    if (isPaused(ctx, today)) return { state: 'paused', dueToday: false, progress: null, label: 'Pausiert' }
    if (isRelapse(ctx, today)) return { state: 'relapse', dueToday: true, progress: null, label: 'Rückfall heute' }
    return { state: 'done', dueToday: true, progress: null, label: 'Heute sauber' }
  }

  const done = isDone(ctx, today)
  const partial = !done && (ctx.values.get(today) ?? 0) > 0 && h.tracking_mode === 'counter'

  let progress: TodayInfo['progress'] = null
  let period: PeriodInfo | null = null
  if (type === 'times_per_week' || type === 'times_per_month') {
    period = periodInfo(ctx, today, today)
    progress = { count: period.count, target: period.target, period: type === 'times_per_week' ? 'week' : 'month' }
  }

  if (isPaused(ctx, today)) {
    if (done) return { state: 'done', dueToday: false, progress, label: 'Erledigt' }
    return { state: 'paused', dueToday: false, progress, label: 'Pausiert' }
  }

  switch (type) {
    case 'daily':
      if (done) return { state: 'done', dueToday: true, progress, label: 'Erledigt' }
      return { state: partial ? 'partial' : 'due', dueToday: true, progress, label: 'Heute fällig' }

    case 'weekdays': {
      const scheduled = scheduledWeekdays(h).includes(isoWeekday(today))
      if (done) return { state: 'done', dueToday: scheduled, progress, label: 'Erledigt' }
      if (scheduled) return { state: partial ? 'partial' : 'due', dueToday: true, progress, label: 'Heute fällig' }
      return { state: partial ? 'partial' : 'rest', dueToday: false, progress, label: nextWeekdayLabel(h, today) }
    }

    case 'every_n_days': {
      const due = isEveryNDue(ctx, today)
      if (done) return { state: 'done', dueToday: true, progress, label: 'Erledigt' }
      if (due) {
        const overdue = effectiveGap(ctx, previousAnchor(ctx, today), today) - everyNInterval(h)
        const label = overdue > 0 && ctx.doneDates.length > 0 ? `Überfällig seit ${plural(overdue, 'Tag', 'Tagen')}` : 'Heute fällig'
        return { state: partial ? 'partial' : 'due', dueToday: true, progress, label }
      }
      const last = previousAnchor(ctx, today)
      const rest = everyNInterval(h) - effectiveGap(ctx, last, today)
      return {
        state: partial ? 'partial' : 'rest',
        dueToday: false,
        progress,
        label: rest === 1 ? 'Fällig morgen' : `Fällig in ${rest} Tagen`,
      }
    }

    case 'times_per_week':
    case 'times_per_month': {
      const p = period!
      const label = progressLabel(progress!)
      if (done) return { state: 'done', dueToday: true, progress, label }
      if (p.met) return { state: 'rest', dueToday: false, progress, label }
      return { state: partial ? 'partial' : 'open', dueToday: true, progress, label }
    }
  }
}

function nextWeekdayLabel(h: HabitLogic, today: DateStr): string {
  const days = scheduledWeekdays(h)
  if (days.length === 0) return 'Kein Wochentag gewählt'
  const wd = isoWeekday(today)
  for (let i = 1; i <= 7; i++) {
    const cand = ((wd - 1 + i) % 7) + 1
    if (days.includes(cand)) return i === 1 ? 'Morgen wieder' : `Nächstes Mal: ${WEEKDAY_SHORT[cand - 1]}`
  }
  return ''
}

/** Kurzbeschreibung des Wiederholungsmodells für Anzeige, z. B. "3× pro Woche". */
export function describeSchedule(h: HabitLogic): string {
  switch (effectiveScheduleType(h)) {
    case 'daily':
      return 'Jeden Tag'
    case 'weekdays': {
      const days = [...scheduledWeekdays(h)].sort((a, b) => a - b)
      if (days.length === 0) return 'Kein Wochentag'
      if (days.length === 7) return 'Jeden Tag'
      return days.map((d) => WEEKDAY_SHORT[d - 1]).join(', ')
    }
    case 'times_per_week':
      return `${timesTarget(h)}× pro Woche`
    case 'times_per_month':
      return `${timesTarget(h)}× pro Monat`
    case 'every_n_days': {
      const n = everyNInterval(h)
      return n === 1 ? 'Jeden Tag' : `Alle ${n} Tage`
    }
  }
}
