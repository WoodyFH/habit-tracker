import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsToFirst,
  diffDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  fromDayNum,
  isDateStr,
  isoWeekNumber,
  isoWeekday,
  startOfMonth,
  startOfWeek,
  toDayNum,
  todayStr,
} from './dates'

describe('dates', () => {
  it('rechnet Tageszahlen hin und zurück', () => {
    expect(toDayNum('1970-01-01')).toBe(0)
    expect(fromDayNum(0)).toBe('1970-01-01')
    for (const d of ['2000-02-29', '2024-02-29', '2026-12-31', '1999-01-01', '2100-03-01']) {
      expect(fromDayNum(toDayNum(d))).toBe(d)
    }
  })

  it('addDays über Monats-, Jahres- und Schaltjahrgrenzen', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366)
  })

  it('Sommerzeitumstellung verschiebt keine Tage (reine Kalenderarithmetik)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(eachDay('2026-10-24', '2026-10-27')).toHaveLength(4)
  })

  it('ISO-Wochentag: 1 = Montag … 7 = Sonntag', () => {
    expect(isoWeekday('2026-03-02')).toBe(1) // Montag
    expect(isoWeekday('2026-03-08')).toBe(7) // Sonntag
    expect(isoWeekday('1970-01-01')).toBe(4) // Donnerstag
    expect(isoWeekday('1969-12-31')).toBe(3)
  })

  it('Wochen beginnen am Montag', () => {
    expect(startOfWeek('2026-03-02')).toBe('2026-03-02')
    expect(startOfWeek('2026-03-08')).toBe('2026-03-02')
    expect(endOfWeek('2026-03-04')).toBe('2026-03-08')
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29') // Donnerstag → Montag davor
  })

  it('Monatsgrenzen', () => {
    expect(startOfMonth('2026-02-17')).toBe('2026-02-01')
    expect(endOfMonth('2026-02-17')).toBe('2026-02-28')
    expect(endOfMonth('2024-02-17')).toBe('2024-02-29')
    expect(addMonthsToFirst('2026-11-15', 2)).toBe('2027-01-01')
    expect(addMonthsToFirst('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('ISO-Kalenderwoche', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1)
    expect(isoWeekNumber('2025-12-29')).toBe(1)
    expect(isoWeekNumber('2026-12-31')).toBe(53)
    expect(isoWeekNumber('2026-03-02')).toBe(10)
  })

  it('Validierung', () => {
    expect(isDateStr('2026-02-29')).toBe(false)
    expect(isDateStr('2024-02-29')).toBe(true)
    expect(isDateStr('2026-13-01')).toBe(false)
    expect(isDateStr('2026-1-1')).toBe(false)
    expect(isDateStr(null)).toBe(false)
  })

  it('todayStr nutzt Europe/Vienna, nicht UTC', () => {
    // 23:30 UTC am 14.3. = 00:30 am 15.3. in Wien (Winterzeit, UTC+1)
    expect(todayStr(new Date('2026-03-14T23:30:00Z'))).toBe('2026-03-15')
    // 22:30 UTC am 28.3. = 23:30 in Wien (noch Winterzeit)
    expect(todayStr(new Date('2026-03-28T22:30:00Z'))).toBe('2026-03-28')
    // Sommerzeit (UTC+2): 22:30 UTC am 15.7. = 00:30 am 16.7.
    expect(todayStr(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16')
    // Gegenprobe: gleiche Instants in UTC wären ein anderer Tag
    expect(todayStr(new Date('2026-07-15T22:30:00Z'), 'UTC')).toBe('2026-07-15')
  })
})
