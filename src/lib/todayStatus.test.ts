import { describe, expect, it } from 'vitest'
import { mustDoToday, todayStatus } from './todayStatus'
import { ctx, habit } from './testUtils'
import type { Habit } from './types'

// März 2026: Mo 2 · Di 3 · Mi 4 · Do 5 · Fr 6 · Sa 7 · So 8

const weekly3 = habit({ start_date: '2026-01-05', schedule_type: 'times_per_week', schedule_config: { times: 3 } })

describe('mustDoToday (Wochenziel 3×)', () => {
  it('Mittwoch ohne Erledigung: noch optional (3 fehlen, 5 Tage übrig)', () => {
    expect(mustDoToday(ctx(weekly3), '2026-03-04')).toBe(false)
  })
  it('Freitag ohne Erledigung: verpflichtend (3 fehlen, 3 Tage übrig)', () => {
    expect(mustDoToday(ctx(weekly3), '2026-03-06')).toBe(true)
  })
  it('Donnerstag mit 1 Erledigung: optional (2 fehlen, 4 Tage übrig)', () => {
    expect(mustDoToday(ctx(weekly3, ['2026-03-02']), '2026-03-05')).toBe(false)
  })
  it('Samstag mit 1 Erledigung: verpflichtend (2 fehlen, 2 Tage übrig)', () => {
    expect(mustDoToday(ctx(weekly3, ['2026-03-02']), '2026-03-07')).toBe(true)
  })
  it('Sonntag mit 2 Erledigungen: verpflichtend (1 fehlt, 1 Tag übrig)', () => {
    expect(mustDoToday(ctx(weekly3, ['2026-03-02', '2026-03-03']), '2026-03-08')).toBe(true)
  })
  it('Ziel erreicht: nicht verpflichtend', () => {
    expect(mustDoToday(ctx(weekly3, ['2026-03-02', '2026-03-03', '2026-03-04']), '2026-03-06')).toBe(false)
  })
  it('Pausentage zählen nicht als verbleibende Tage', () => {
    // Do–So (4 Tage) pausiert, Mi ist der letzte aktive Tag: 3 fehlen, aber Ziel wird auf 3 aktive Tage (Mo–Mi) begrenzt
    const c = ctx(weekly3, [], [['2026-03-05', '2026-03-08']])
    expect(mustDoToday(c, '2026-03-04')).toBe(true)
    expect(mustDoToday(c, '2026-03-02')).toBe(true) // 3 fehlen, 3 aktive Tage übrig
  })
  it('Monatsziel: letzter Tage des Monats mit fehlender Erledigung ist verpflichtend', () => {
    const m = habit({ start_date: '2026-01-01', schedule_type: 'times_per_month', schedule_config: { times: 2 } })
    expect(mustDoToday(ctx(m, ['2026-03-01']), '2026-03-30')).toBe(false) // 1 fehlt, 2 Tage übrig
    expect(mustDoToday(ctx(m, ['2026-03-01']), '2026-03-31')).toBe(true) // 1 fehlt, 1 Tag übrig
  })
})

function h(id: string, over: Partial<Habit> = {}): Habit {
  return { id, name: id, color: 'blue', archived: false, ...over } as Habit
}

describe('todayStatus', () => {
  it('trennt verpflichtend, optional und erledigt; Zähler zählt Optionales nicht', () => {
    const daily = h('daily')
    const weekly = h('weekly')
    const doneDaily = h('doneDaily')
    const map = new Map([
      ['daily', ctx(habit({ start_date: '2026-01-01' }))],
      ['weekly', ctx(weekly3)],
      ['doneDaily', ctx(habit({ start_date: '2026-01-01' }), ['2026-03-04'])],
    ])
    const s = todayStatus([daily, weekly, doneDaily], map, '2026-03-04')
    expect(s.segments.map((x) => x.kind)).toEqual(['required', 'optional', 'done'])
    expect(s).toMatchObject({ total: 2, done: 1, optionalOpen: 1 })
  })

  it('Wochengewohnheit wird am Freitag verpflichtend und zählt dann im Nenner', () => {
    const map = new Map([['weekly', ctx(weekly3)]])
    const s = todayStatus([h('weekly')], map, '2026-03-06')
    expect(s.segments[0].kind).toBe('required')
    expect(s).toMatchObject({ total: 1, done: 0, optionalOpen: 0 })
  })

  it('heute erledigte Wochengewohnheit zählt als erledigt', () => {
    const map = new Map([['weekly', ctx(weekly3, ['2026-03-04'])]])
    const s = todayStatus([h('weekly')], map, '2026-03-04')
    expect(s.segments[0].kind).toBe('done')
    expect(s).toMatchObject({ total: 1, done: 1 })
  })

  it('Wochenziel bereits erreicht, heute nicht erledigt: erscheint gar nicht', () => {
    const map = new Map([['weekly', ctx(weekly3, ['2026-03-02', '2026-03-03', '2026-03-04'])]])
    expect(todayStatus([h('weekly')], map, '2026-03-05').segments).toHaveLength(0)
  })

  it('Archivierte und nicht fällige Gewohnheiten werden übersprungen', () => {
    const mon = habit({ start_date: '2026-01-01', schedule_type: 'weekdays', schedule_config: { weekdays: [1] } })
    const map = new Map([
      ['a', ctx(habit({ start_date: '2026-01-01' }))],
      ['b', ctx(mon)],
    ])
    const s = todayStatus([h('a', { archived: true }), h('b')], map, '2026-03-04') // Mittwoch
    expect(s.segments).toHaveLength(0)
  })
})
