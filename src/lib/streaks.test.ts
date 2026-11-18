import { describe, expect, it } from 'vitest'
import { computeStats, computeStreaks, everyNIntervals, quitSummary, successRate } from './streaks'
import { ctx, habit, range } from './testUtils'

// Kalender: Februar 2026: Mo 2, 9, 16, 23 · März 2026: Mo 2, 9

describe('Tages-Serien (täglich)', () => {
  const h = habit({ start_date: '2026-03-01' })

  it('aktuelle und längste Serie', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'])
    expect(computeStreaks(c, '2026-03-06')).toEqual({ current: 2, longest: 3, unit: 'days' })
  })

  it('heute noch offen bricht die Serie nicht', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(computeStreaks(c, '2026-03-04').current).toBe(3)
  })

  it('gestern verpasst bricht die Serie', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02'])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 0, longest: 2 })
  })

  it('heute erledigt nach verpasstem gestern: Serie 1', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02', '2026-03-04'])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 1, longest: 2 })
  })

  it('neue Gewohnheit ohne Einträge hat Serie 0', () => {
    expect(computeStreaks(ctx(h), '2026-03-01')).toMatchObject({ current: 0, longest: 0 })
    expect(computeStreaks(ctx(h), '2026-02-20')).toMatchObject({ current: 0, longest: 0 }) // vor Start
  })

  it('Pause lässt die Serie nicht reißen', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02', '2026-03-08'], [['2026-03-03', '2026-03-07']])
    expect(computeStreaks(c, '2026-03-08')).toMatchObject({ current: 3, longest: 3 })
  })

  it('Pause ohne Rückkehr-Eintrag: Serie bleibt bestehen, solange heute noch offen', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02'], [['2026-03-03', '2026-03-10']])
    expect(computeStreaks(c, '2026-03-10').current).toBe(2)
    expect(computeStreaks(c, '2026-03-11').current).toBe(2) // 11. noch offen
    expect(computeStreaks(c, '2026-03-12').current).toBe(0) // 11. verpasst
  })

  it('Enddatum begrenzt die Auswertung', () => {
    const c = ctx({ ...h, end_date: '2026-03-03' }, ['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(computeStreaks(c, '2026-04-01')).toMatchObject({ current: 3, longest: 3 })
  })
})

describe('Tages-Serien (Wochentage)', () => {
  const h = habit({ start_date: '2026-03-02', schedule_type: 'weekdays', schedule_config: { weekdays: [1, 3, 5] } })

  it('nicht fällige Tage unterbrechen die Serie nicht', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09'])
    expect(computeStreaks(c, '2026-03-09')).toMatchObject({ current: 4, longest: 4, unit: 'days' })
  })

  it('ein verpasster fälliger Tag bricht', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-06', '2026-03-09'])
    expect(computeStreaks(c, '2026-03-09')).toMatchObject({ current: 2, longest: 2 })
  })

  it('Bonus-Erledigung an einem freien Tag verlängert die Serie nicht', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-03', '2026-03-04'])
    expect(computeStreaks(c, '2026-03-04').current).toBe(2)
  })
})

describe('Wochen-Serien (X-mal pro Woche)', () => {
  const h = habit({ start_date: '2026-02-02', schedule_type: 'times_per_week', schedule_config: { times: 3 } })
  // Wochen: 02.02 | 09.02 | 16.02 | 23.02 | 02.03 (aktuell, heute = Mi 04.03.)
  const w1 = ['2026-02-02', '2026-02-04', '2026-02-06']
  const w2 = ['2026-02-09', '2026-02-10', '2026-02-11']
  const w3 = ['2026-02-16', '2026-02-17'] // nur 2 → verfehlt
  const w4 = ['2026-02-23', '2026-02-25', '2026-02-27']

  it('Einheit ist Wochen; verfehlte Woche bricht; laufende unerreichte Woche bricht nicht', () => {
    const c = ctx(h, [...w1, ...w2, ...w3, ...w4, '2026-03-02'])
    expect(computeStreaks(c, '2026-03-04')).toEqual({ current: 1, longest: 2, unit: 'weeks' })
  })

  it('laufende Woche erreicht → zählt mit', () => {
    const c = ctx(h, [...w1, ...w2, ...w3, ...w4, '2026-03-02', '2026-03-03', '2026-03-04'])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 2, longest: 2 })
  })

  it('Pausierte Woche wird übersprungen', () => {
    const c = ctx(h, [...w1, ...w2, ...w4], [['2026-02-16', '2026-02-22']])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 3, longest: 3 })
  })

  it('teilweise pausierte Woche braucht nur noch das reduzierte Ziel', () => {
    // Woche 3: Mo–Fr pausiert → 2 aktive Tage (Sa, So) → Ziel 2
    const c = ctx(h, [...w1, ...w2, '2026-02-21', '2026-02-22', ...w4], [['2026-02-16', '2026-02-20']])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 4, longest: 4 })
  })

  it('Wochen laufen von Montag bis Sonntag (Sonntag gehört zur alten Woche)', () => {
    const hh = habit({ start_date: '2026-03-02', schedule_type: 'times_per_week', schedule_config: { times: 2 } })
    // So 08.03. + Mo 09.03. liegen in verschiedenen Wochen
    const c = ctx(hh, ['2026-03-07', '2026-03-08', '2026-03-09'])
    expect(computeStreaks(c, '2026-03-09')).toMatchObject({ current: 1, longest: 1 })
  })

  it('Abbruch: Woche mit 0 Erledigungen', () => {
    const c = ctx(h, [...w1, ...w2])
    expect(computeStreaks(c, '2026-03-04')).toMatchObject({ current: 0, longest: 2 })
  })
})

describe('Monats-Serien (X-mal pro Monat)', () => {
  const h = habit({ start_date: '2026-01-01', schedule_type: 'times_per_month', schedule_config: { times: 2 } })

  it('Einheit ist Monate', () => {
    const c = ctx(h, ['2026-01-05', '2026-01-20', '2026-02-01', '2026-02-28', '2026-03-03'])
    expect(computeStreaks(c, '2026-03-15')).toEqual({ current: 2, longest: 2, unit: 'months' })
  })

  it('verfehlter Monat bricht', () => {
    const c = ctx(h, ['2026-01-05', '2026-01-20', '2026-02-01', '2026-03-03', '2026-03-04'])
    expect(computeStreaks(c, '2026-03-15')).toEqual({ current: 1, longest: 1, unit: 'months' })
  })

  it('Monatsende: 31.1. und 1.2. liegen in verschiedenen Monaten', () => {
    const c = ctx(h, ['2026-01-30', '2026-01-31', '2026-02-01'])
    expect(computeStreaks(c, '2026-02-02')).toMatchObject({ current: 1, longest: 1 }) // Jan erfüllt, Feb offen mit 1/2
  })
})

describe('"Alle N Tage"-Serien', () => {
  const h = habit({ start_date: '2026-03-02', schedule_type: 'every_n_days', schedule_config: { interval: 3 } })

  it('Erledigungen im Abstand von höchstens N Tagen verlängern', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-05', '2026-03-08'])
    expect(computeStreaks(c, '2026-03-09')).toEqual({ current: 3, longest: 3, unit: 'days' })
    expect(computeStreaks(c, '2026-03-11')).toMatchObject({ current: 3 }) // genau N Tage später: letzter fälliger Tag
  })

  it('überfällig → aktuelle Serie 0, längste bleibt', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-05', '2026-03-08'])
    expect(computeStreaks(c, '2026-03-12')).toMatchObject({ current: 0, longest: 3 })
  })

  it('zu späte Erledigung beginnt neue Serie mit 1', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-05', '2026-03-10'])
    expect(computeStreaks(c, '2026-03-10')).toMatchObject({ current: 1, longest: 2 })
  })

  it('vorzeitige Erledigung ist erlaubt', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-03', '2026-03-04'])
    expect(computeStreaks(c, '2026-03-04').current).toBe(3)
  })

  it('Pausen verlängern die erlaubte Lücke', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-12'], [['2026-03-04', '2026-03-10']]) // 10 Tage − 7 Pause = 3
    expect(computeStreaks(c, '2026-03-12')).toMatchObject({ current: 2, longest: 2 })
  })

  it('Intervall 1 entspricht täglich', () => {
    const e = habit({ start_date: '2026-03-01', schedule_type: 'every_n_days', schedule_config: { interval: 1 } })
    const d = habit({ start_date: '2026-03-01' })
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06']
    expect(computeStreaks(ctx(e, dates), '2026-03-06')).toEqual(computeStreaks(ctx(d, dates), '2026-03-06'))
  })

  it('Intervalle: erste Erledigung am Starttag ist rechtzeitig', () => {
    expect(everyNIntervals(ctx(h, ['2026-03-02']), '2026-03-02')).toEqual([{ date: '2026-03-02', ok: true }])
  })

  it('noch nie erledigt und Starttag vorbei → überfällig', () => {
    expect(computeStreaks(ctx(h), '2026-03-04')).toMatchObject({ current: 0, longest: 0 })
    expect(everyNIntervals(ctx(h), '2026-03-04')).toEqual([{ date: '2026-03-03', ok: false, overdue: true }])
  })
})

describe('Abgewöhnen', () => {
  const h = habit({ type: 'quit', start_date: '2026-03-01' })

  it('zählt Tage ohne Rückfall, heute inklusive', () => {
    expect(computeStreaks(ctx(h), '2026-03-10')).toEqual({ current: 10, longest: 10, unit: 'days' })
  })

  it('Rückfall setzt zurück', () => {
    const c = ctx(h, ['2026-03-04'])
    expect(computeStreaks(c, '2026-03-10')).toMatchObject({ current: 6, longest: 6 })
    expect(quitSummary(c, '2026-03-10')).toMatchObject({ cleanDays: 9, relapses: 1, countedDays: 10 })
  })

  it('Rückfall heute → Serie 0', () => {
    expect(computeStreaks(ctx(h, ['2026-03-10']), '2026-03-10').current).toBe(0)
  })

  it('Pausentage zählen weder als sauber noch als Rückfall und reißen nichts', () => {
    const c = ctx(h, [], [['2026-03-04', '2026-03-06']])
    expect(computeStreaks(c, '2026-03-10').current).toBe(7)
    expect(quitSummary(c, '2026-03-10').countedDays).toBe(7)
  })
})

describe('Erfolgsquote & Statistik', () => {
  it('täglich: heute offen zählt nicht negativ', () => {
    const h = habit({ start_date: '2026-03-01' })
    const c = ctx(h, ['2026-03-01', '2026-03-02', '2026-03-04'])
    expect(successRate(c, '2026-03-05')).toBe(75) // 3 von 4 (5.3. noch offen)
    expect(successRate(c, '2026-03-04')).toBe(75) // 4.3. erledigt: 3 von 4 (3.3. verpasst)
    expect(successRate(ctx(h, ['2026-03-01', '2026-03-02', '2026-03-03']), '2026-03-04')).toBe(100) // heute offen zählt nicht
  })

  it('Fenster der letzten 30 Tage', () => {
    const h = habit({ start_date: '2026-01-01' })
    const dates = range('2026-02-04', '2026-03-05') // 30 Tage durchgehend
    const c = ctx(h, dates)
    const s = computeStats(c, '2026-03-05')
    expect(s.rate30).toBe(100)
    expect(s.rateTotal).toBeLessThan(100)
    expect(s.total).toBe(30)
    expect(s.current).toBe(30)
  })

  it('Wochentage: nur fällige Tage zählen', () => {
    const h = habit({ start_date: '2026-03-02', schedule_type: 'weekdays', schedule_config: { weekdays: [1, 3] } })
    const c = ctx(h, ['2026-03-02'])
    expect(successRate(c, '2026-03-08')).toBe(50) // Mo erledigt, Mi verpasst
  })

  it('Wochenziele: erreichte / abgeschlossene Wochen', () => {
    const h = habit({ start_date: '2026-02-02', schedule_type: 'times_per_week', schedule_config: { times: 2 } })
    const c = ctx(h, ['2026-02-02', '2026-02-03', '2026-02-09', '2026-02-16', '2026-02-17'])
    // Wochen 02.02 ✓, 09.02 ✗, 16.02 ✓; laufende Woche (23.02, heute 24.02) offen & nicht erreicht → zählt nicht
    expect(successRate(c, '2026-02-24')).toBe(67)
  })

  it('noch nichts zu bewerten → null', () => {
    const h = habit({ start_date: '2026-03-05' })
    expect(successRate(ctx(h), '2026-03-05')).toBeNull()
    expect(successRate(ctx(h), '2026-03-01')).toBeNull()
  })

  it('Abgewöhnen: Gesamtanzahl = Tage ohne Rückfall', () => {
    const h = habit({ type: 'quit', start_date: '2026-03-01' })
    const s = computeStats(ctx(h, ['2026-03-04']), '2026-03-10')
    expect(s).toMatchObject({ total: 9, relapses: 1, current: 6, longest: 6, rateTotal: 90 })
  })

  it('Zähler: nur Tage mit erreichtem Ziel zählen', () => {
    const h = habit({ start_date: '2026-03-01', tracking_mode: 'counter', target_value: 8 })
    const c = ctx(h, [
      ['2026-03-01', 8],
      ['2026-03-02', 7],
      ['2026-03-03', 10],
    ])
    expect(computeStats(c, '2026-03-03')).toMatchObject({ total: 2, current: 1, longest: 1 })
  })
})
