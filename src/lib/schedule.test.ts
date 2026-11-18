import { describe, expect, it } from 'vitest'
import { dayStatus, describeSchedule, isScheduledDay, mergeRanges, periodInfo, todayInfo } from './schedule'
import { ctx, habit } from './testUtils'

// Kalender März 2026:  Mo 2 · Di 3 · Mi 4 · Do 5 · Fr 6 · Sa 7 · So 8 · Mo 9 …

describe('täglich', () => {
  const h = habit({ start_date: '2026-03-02' })

  it('vergangene unerledigte Tage sind verpasst, heute ist offen, Zukunft ist Zukunft', () => {
    const c = ctx(h, ['2026-03-03'])
    const today = '2026-03-04'
    expect(dayStatus(c, '2026-03-02', today)).toBe('missed')
    expect(dayStatus(c, '2026-03-03', today)).toBe('done')
    expect(dayStatus(c, '2026-03-04', today)).toBe('open')
    expect(dayStatus(c, '2026-03-05', today)).toBe('future')
  })

  it('vor dem Startdatum und nach dem Enddatum ist alles neutral', () => {
    const c = ctx({ ...h, end_date: '2026-03-06' })
    expect(dayStatus(c, '2026-03-01', '2026-03-10')).toBe('neutral')
    expect(dayStatus(c, '2026-03-07', '2026-03-10')).toBe('neutral')
    expect(dayStatus(c, '2026-03-06', '2026-03-10')).toBe('missed')
  })

  it('heute: Status fällig / erledigt', () => {
    expect(todayInfo(ctx(h), '2026-03-04')).toMatchObject({ state: 'due', dueToday: true, label: 'Heute fällig' })
    expect(todayInfo(ctx(h, ['2026-03-04']), '2026-03-04')).toMatchObject({ state: 'done', dueToday: true })
    expect(todayInfo(ctx(h), '2026-03-01').state).toBe('notstarted')
    expect(todayInfo(ctx({ ...h, end_date: '2026-03-03' }), '2026-03-04').state).toBe('ended')
  })
})

describe('bestimmte Wochentage', () => {
  const h = habit({ start_date: '2026-03-02', schedule_type: 'weekdays', schedule_config: { weekdays: [1, 3, 5] } })

  it('nicht fällige Tage sind neutral und nie verpasst', () => {
    const c = ctx(h)
    const today = '2026-03-08'
    expect(dayStatus(c, '2026-03-02', today)).toBe('missed') // Mo
    expect(dayStatus(c, '2026-03-03', today)).toBe('neutral') // Di
    expect(dayStatus(c, '2026-03-04', today)).toBe('missed') // Mi
    expect(dayStatus(c, '2026-03-07', today)).toBe('neutral') // Sa
    expect(isScheduledDay(c, '2026-03-06')).toBe(true)
    expect(isScheduledDay(c, '2026-03-07')).toBe(false)
  })

  it('Erledigung an einem nicht fälligen Tag wird als erledigt angezeigt', () => {
    expect(dayStatus(ctx(h, ['2026-03-03']), '2026-03-03', '2026-03-08')).toBe('done')
  })

  it('heute fällig vs. Ruhetag mit Hinweis auf nächsten Termin', () => {
    const c = ctx(h)
    expect(todayInfo(c, '2026-03-04')).toMatchObject({ state: 'due', dueToday: true }) // Mi
    expect(todayInfo(c, '2026-03-03')).toMatchObject({ state: 'rest', dueToday: false, label: 'Morgen wieder' }) // Di
    expect(todayInfo(c, '2026-03-06')).toMatchObject({ state: 'due' }) // Fr
    expect(todayInfo(c, '2026-03-07')).toMatchObject({ state: 'rest', label: 'Nächstes Mal: Mo' }) // Sa
  })

  it('Beschreibung', () => {
    expect(describeSchedule(h)).toBe('Mo, Mi, Fr')
    expect(describeSchedule(habit({ schedule_type: 'weekdays', schedule_config: { weekdays: [1, 2, 3, 4, 5, 6, 7] } }))).toBe('Jeden Tag')
  })
})

describe('X-mal pro Woche', () => {
  const h = habit({ start_date: '2026-01-05', schedule_type: 'times_per_week', schedule_config: { times: 3 } })

  it('Fortschritt "2 von 3 diese Woche"', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-04'])
    const info = todayInfo(c, '2026-03-05')
    expect(info.state).toBe('open')
    expect(info.dueToday).toBe(true)
    expect(info.progress).toEqual({ count: 2, target: 3, period: 'week' })
    expect(info.label).toBe('2 von 3 diese Woche')
  })

  it('Ziel erreicht → heute nicht mehr fällig (Ruhe), erledigt-heute bleibt sichtbar', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-03', '2026-03-04'])
    expect(todayInfo(c, '2026-03-05')).toMatchObject({ state: 'rest', dueToday: false })
    expect(todayInfo(c, '2026-03-04')).toMatchObject({ state: 'done', dueToday: true })
  })

  it('Woche läuft Montag bis Sonntag', () => {
    const c = ctx(h, ['2026-03-01', '2026-03-02']) // So (alte Woche), Mo (neue Woche)
    expect(periodInfo(c, '2026-03-04', '2026-03-04').count).toBe(1)
    expect(periodInfo(c, '2026-03-04', '2026-03-04')).toMatchObject({ from: '2026-03-02', to: '2026-03-08' })
  })

  it('Tage ohne Erledigung sind "offen", nie "verpasst"', () => {
    const c = ctx(h)
    expect(dayStatus(c, '2026-03-02', '2026-03-05')).toBe('open')
    expect(dayStatus(c, '2026-03-05', '2026-03-05')).toBe('open')
  })

  it('angefangene Woche: Ziel wird auf aktive Tage begrenzt', () => {
    // Start am Samstag → nur Sa + So aktiv → Ziel 2 statt 3
    const hs = { ...h, start_date: '2026-03-07' }
    const p = periodInfo(ctx(hs, ['2026-03-07', '2026-03-08']), '2026-03-08', '2026-03-09')
    expect(p).toMatchObject({ activeDays: 2, target: 2, count: 2, met: true, closed: true })
  })

  it('Pausen reduzieren das Wochenziel; komplett pausierte Woche ist neutral', () => {
    const c = ctx(h, [], [['2026-03-02', '2026-03-06']]) // Mo–Fr pausiert → 2 aktive Tage
    expect(periodInfo(c, '2026-03-04', '2026-03-04')).toMatchObject({ activeDays: 2, target: 2 })
    const whole = ctx(h, [], [['2026-03-02', '2026-03-08']])
    expect(periodInfo(whole, '2026-03-04', '2026-03-04').neutral).toBe(true)
    expect(todayInfo(whole, '2026-03-04').state).toBe('paused')
  })
})

describe('X-mal pro Monat', () => {
  const h = habit({ start_date: '2026-01-01', schedule_type: 'times_per_month', schedule_config: { times: 4 } })

  it('Fortschritt "1 von 4 diesen Monat"', () => {
    const c = ctx(h, ['2026-03-01'])
    const info = todayInfo(c, '2026-03-10')
    expect(info.label).toBe('1 von 4 diesen Monat')
    expect(info.progress).toEqual({ count: 1, target: 4, period: 'month' })
  })

  it('Monatsgrenze: Februar 2026 hat 28 Tage', () => {
    expect(periodInfo(ctx(h), '2026-02-10', '2026-03-01')).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
      closed: true,
    })
  })
})

describe('alle N Tage', () => {
  const h = habit({ start_date: '2026-03-02', schedule_type: 'every_n_days', schedule_config: { interval: 3 } })

  it('Starttag ist fällig, danach N−1 Ruhetage, am N-ten Tag wieder fällig', () => {
    const c = ctx(h, ['2026-03-02'])
    const today = '2026-03-10'
    expect(dayStatus(c, '2026-03-02', today)).toBe('done')
    expect(dayStatus(c, '2026-03-03', today)).toBe('neutral')
    expect(dayStatus(c, '2026-03-04', today)).toBe('neutral')
    expect(dayStatus(c, '2026-03-05', today)).toBe('missed') // fällig, aber nicht erledigt
  })

  it('Fälligkeit richtet sich nach der letzten Erledigung (gleitend)', () => {
    const c = ctx(h, ['2026-03-02', '2026-03-06']) // 2. Mal einen Tag später
    expect(isScheduledDay(c, '2026-03-08')).toBe(false)
    expect(isScheduledDay(c, '2026-03-09')).toBe(true)
  })

  it('heute: Hinweise', () => {
    const c = ctx(h, ['2026-03-02'])
    expect(todayInfo(c, '2026-03-03')).toMatchObject({ state: 'rest', dueToday: false, label: 'Fällig in 2 Tagen' })
    expect(todayInfo(c, '2026-03-04')).toMatchObject({ label: 'Fällig morgen' })
    expect(todayInfo(c, '2026-03-05')).toMatchObject({ state: 'due', dueToday: true, label: 'Heute fällig' })
    expect(todayInfo(c, '2026-03-07')).toMatchObject({ state: 'due', label: 'Überfällig seit 2 Tagen' })
  })

  it('Pausentage zählen nicht mit', () => {
    const c = ctx(h, ['2026-03-02'], [['2026-03-03', '2026-03-10']])
    expect(isScheduledDay(c, '2026-03-05')).toBe(false) // pausiert
    expect(isScheduledDay(c, '2026-03-11')).toBe(false) // erst 1 wirksamer Tag seit Erledigung
    expect(isScheduledDay(c, '2026-03-13')).toBe(true) // 3 wirksame Tage
  })

  it('Intervall 1 verhält sich wie täglich', () => {
    const c = ctx({ ...h, schedule_config: { interval: 1 } }, ['2026-03-02'])
    expect(dayStatus(c, '2026-03-03', '2026-03-04')).toBe('missed')
    expect(todayInfo(c, '2026-03-03').state).toBe('due')
  })
})

describe('Pausen', () => {
  it('pausierte Tage sind neutral, auch wenn sie sonst verpasst wären', () => {
    const c = ctx(habit({ start_date: '2026-03-02' }), [], [['2026-03-03', '2026-03-04']])
    expect(dayStatus(c, '2026-03-03', '2026-03-06')).toBe('neutral')
    expect(dayStatus(c, '2026-03-05', '2026-03-06')).toBe('missed')
    expect(todayInfo(c, '2026-03-04')).toMatchObject({ state: 'paused', dueToday: false })
  })

  it('Pausen werden zusammengeführt', () => {
    expect(
      mergeRanges([
        { from: '2026-03-05', to: '2026-03-07' },
        { from: '2026-03-01', to: '2026-03-04' },
        { from: '2026-03-20', to: '2026-03-22' },
        { from: '2026-03-06', to: '2026-03-10' },
      ]),
    ).toEqual([
      { from: '2026-03-01', to: '2026-03-10' },
      { from: '2026-03-20', to: '2026-03-22' },
    ])
  })

  it('gelöschte Pausen und gelöschte Einträge werden ignoriert', () => {
    const h = habit({ start_date: '2026-03-02' })
    const c = ctx(h)
    expect(c.pauses).toHaveLength(0)
  })
})

describe('Zähler', () => {
  const h = habit({ start_date: '2026-03-02', tracking_mode: 'counter', target_value: 8, schedule_type: 'daily' })

  it('teilweise vs. Ziel erreicht', () => {
    const c = ctx(h, [
      ['2026-03-02', 8],
      ['2026-03-03', 5],
    ])
    expect(dayStatus(c, '2026-03-02', '2026-03-05')).toBe('done')
    expect(dayStatus(c, '2026-03-03', '2026-03-05')).toBe('partial')
    expect(dayStatus(c, '2026-03-04', '2026-03-05')).toBe('missed')
    expect(todayInfo(ctx(h, [['2026-03-05', 3]]), '2026-03-05').state).toBe('partial')
  })
})

describe('Abgewöhnen', () => {
  const h = habit({ type: 'quit', start_date: '2026-03-02' })

  it('jeder Tag ohne Rückfall ist gelungen, ein Eintrag ist ein Rückfall', () => {
    const c = ctx(h, ['2026-03-04'])
    expect(dayStatus(c, '2026-03-02', '2026-03-06')).toBe('done')
    expect(dayStatus(c, '2026-03-04', '2026-03-06')).toBe('missed')
    expect(dayStatus(c, '2026-03-06', '2026-03-06')).toBe('done')
    expect(dayStatus(c, '2026-03-07', '2026-03-06')).toBe('future')
    expect(todayInfo(c, '2026-03-04')).toMatchObject({ state: 'relapse' })
    expect(todayInfo(c, '2026-03-06')).toMatchObject({ state: 'done', label: 'Heute sauber' })
  })

  it('Wiederholung ist immer täglich, egal was gespeichert ist', () => {
    const q = habit({ type: 'quit', schedule_type: 'times_per_week', schedule_config: { times: 1 }, start_date: '2026-03-02' })
    expect(describeSchedule(q)).toBe('Jeden Tag')
  })
})
