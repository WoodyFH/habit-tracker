// Reine Datumsfunktionen auf lokalen Kalendertagen ("YYYY-MM-DD").
// Intern wird mit fortlaufenden Tageszahlen gerechnet (Tage seit 1970-01-01, proleptisch gregorianisch),
// dadurch gibt es keine Zeitzonen- oder Sommerzeit-Effekte.

import type { DateStr } from './types'

export const APP_TIME_ZONE = 'Europe/Vienna'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string') return false
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/** Tage seit 1970-01-01 (Howard Hinnant, days_from_civil). */
function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

function civilFromDays(z: number): [number, number, number] {
  z += 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp + (mp < 10 ? 3 : -9)
  return [y + (m <= 2 ? 1 : 0), m, d]
}

export function parseDate(s: DateStr): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(s)
  if (!match) throw new Error(`Ungültiges Datum: "${s}"`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/** "YYYY-MM-DD" → Tageszahl */
export function toDayNum(s: DateStr): number {
  const { y, m, d } = parseDate(s)
  return daysFromCivil(y, m, d)
}

/** Tageszahl → "YYYY-MM-DD" */
export function fromDayNum(n: number): DateStr {
  const [y, m, d] = civilFromDays(n)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function addDays(s: DateStr, n: number): DateStr {
  return fromDayNum(toDayNum(s) + n)
}

/** Anzahl Tage von a nach b (b - a). */
export function diffDays(a: DateStr, b: DateStr): number {
  return toDayNum(b) - toDayNum(a)
}

export function compareDates(a: DateStr, b: DateStr): number {
  // Das Format ist lexikographisch sortierbar.
  return a < b ? -1 : a > b ? 1 : 0
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a <= b ? a : b
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a >= b ? a : b
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(s: DateStr): number {
  // 1970-01-01 war ein Donnerstag (= 4)
  const n = toDayNum(s)
  return ((((n + 3) % 7) + 7) % 7) + 1
}

/** Montag der Woche, in der s liegt (Wochen beginnen am Montag). */
export function startOfWeek(s: DateStr): DateStr {
  return addDays(s, -(isoWeekday(s) - 1))
}

export function endOfWeek(s: DateStr): DateStr {
  return addDays(startOfWeek(s), 6)
}

export function startOfMonth(s: DateStr): DateStr {
  const { y, m } = parseDate(s)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
}

export function endOfMonth(s: DateStr): DateStr {
  const { y, m } = parseDate(s)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`
}

export function addMonthsToFirst(s: DateStr, n: number): DateStr {
  const { y, m } = parseDate(startOfMonth(s))
  const idx = y * 12 + (m - 1) + n
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-01`
}

/** Alle Tage von from bis to (inklusive). Leer, wenn to < from. */
export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const a = toDayNum(from)
  const b = toDayNum(to)
  const out: DateStr[] = []
  for (let n = a; n <= b; n++) out.push(fromDayNum(n))
  return out
}

/** Heutiges Datum als lokaler Kalendertag in Europe/Vienna (nicht UTC). */
export function todayStr(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): DateStr {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

// ---------- Anzeige (Deutsch) ----------

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const WEEKDAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
export const MONTH_NAMES = [
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]
export const MONTH_SHORT = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** z. B. "12.03.2026" */
export function formatDateDE(s: DateStr): string {
  const { y, m, d } = parseDate(s)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}

/** z. B. "12. Mär" */
export function formatDayMonth(s: DateStr): string {
  const { m, d } = parseDate(s)
  return `${d}. ${MONTH_SHORT[m - 1]}`
}

export function dayOfMonth(s: DateStr): number {
  return parseDate(s).d
}

/** ISO-Kalenderwoche (1–53). */
export function isoWeekNumber(s: DateStr): number {
  const thursday = addDays(startOfWeek(s), 3)
  const { y } = parseDate(thursday)
  const jan1 = `${String(y).padStart(4, '0')}-01-01`
  return Math.floor(diffDays(jan1, thursday) / 7) + 1
}

/** z. B. "Mittwoch, 4. März 2026" */
export function formatLongDE(s: DateStr): string {
  const { y, m, d } = parseDate(s)
  return `${WEEKDAY_LONG[isoWeekday(s) - 1]}, ${d}. ${MONTH_NAMES[m - 1]} ${y}`
}

/** z. B. "Mi, 4. Mär" */
export function formatShortDE(s: DateStr): string {
  const { m, d } = parseDate(s)
  return `${WEEKDAY_SHORT[isoWeekday(s) - 1]}, ${d}. ${MONTH_SHORT[m - 1]}`
}

/** z. B. "Mittwoch, 4. Mär" (für die Kopfzeile) */
export function formatMedDE(s: DateStr): string {
  const { m, d } = parseDate(s)
  return `${WEEKDAY_LONG[isoWeekday(s) - 1]}, ${d}. ${MONTH_SHORT[m - 1]}`
}
