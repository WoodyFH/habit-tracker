import { describe, expect, it } from 'vitest'
import { computeWidgetModel, type RawData } from './model'

// Donnerstag, 19. November 2026 (Woche Mo 16.11. – So 22.11.)
const TODAY = '2026-11-19'

const base = {
  description: null,
  icon: 'check',
  type: 'build',
  tracking_mode: 'yes_no',
  target_value: null,
  unit: null,
  schedule_type: 'daily',
  schedule_config: {},
  start_date: '2026-01-01',
  end_date: null,
  archived: false,
  deleted_at: null,
}
const habit = (id: string, name: string, color: string, order: number, over: Record<string, unknown> = {}) => ({ ...base, id, name, color, sort_order: order, ...over })
const comp = (habit_id: string, date: string) => ({ habit_id, date, value: 1, deleted_at: null })

const raw = (over: Partial<RawData> = {}): RawData => ({ habits: [], completions: [], pauses: [], ...over })

describe('computeWidgetModel', () => {
  it('zählt verpflichtend vs. erledigt und liefert die offenen Pflicht-Gewohnheiten', () => {
    const m = computeWidgetModel(
      raw({
        habits: [habit('a', 'Meditieren', 'violet', 1), habit('b', 'Vitamine', 'lime', 2), habit('c', 'Wasser', 'sky', 3)],
        completions: [comp('a', TODAY)],
      }),
      TODAY,
    )
    expect(m).toMatchObject({ dateLabel: 'Do, 19. Nov', done: 1, total: 3, optionalOpen: 0 })
    expect(m.segments.map((s) => s.kind)).toEqual(['done', 'required', 'required'])
    expect(m.openRequired.map((s) => s.name)).toEqual(['Vitamine', 'Wasser'])
    expect(m.segments[0].hex).toBe('#8b5cf6')
    expect(m.weekLine).toBeNull()
  })

  it('Wochenziel ist optional und erscheint in der Wochenzeile', () => {
    const m = computeWidgetModel(
      raw({
        habits: [
          habit('a', 'Meditieren', 'violet', 1),
          habit('w', 'Laufen', 'sky', 2, { schedule_type: 'times_per_week', schedule_config: { times: 2 } }),
        ],
        completions: [comp('w', '2026-11-17')],
      }),
      TODAY,
    )
    expect(m.segments.map((s) => s.kind)).toEqual(['required', 'optional'])
    expect(m).toMatchObject({ total: 1, done: 0, optionalOpen: 1 })
    expect(m.weekLine).toBe('Diese Woche: Laufen 1/2')
  })

  it('Wochenziel wird am Ende der Woche verpflichtend', () => {
    const w = habit('w', 'Training', 'orange', 1, { schedule_type: 'times_per_week', schedule_config: { times: 3 } })
    // Sonntag 22.11.: 1 Erledigung, 2 fehlen, nur noch 1 Tag übrig → Ziel unerreichbar, aber "muss": missing ≥ remaining
    const m = computeWidgetModel(raw({ habits: [w], completions: [comp('w', '2026-11-16')] }), '2026-11-22')
    expect(m.segments[0].kind).toBe('required')
    expect(m.openRequired.map((s) => s.name)).toEqual(['Training'])
  })

  it('Archivierte, gelöschte und pausierte Gewohnheiten werden ausgelassen', () => {
    const m = computeWidgetModel(
      raw({
        habits: [
          habit('a', 'Archiv', 'red', 1, { archived: true }),
          habit('b', 'Gelöscht', 'red', 2, { deleted_at: '2026-11-01T00:00:00Z' }),
          habit('c', 'Pause', 'red', 3),
          habit('d', 'Aktiv', 'red', 4),
        ],
        pauses: [{ habit_id: 'c', from_date: '2026-11-10', to_date: '2026-11-25', deleted_at: null }],
      }),
      TODAY,
    )
    expect(m.segments.map((s) => s.name)).toEqual(['Aktiv'])
  })

  it('gelöschte Einträge zählen nicht, Reihenfolge folgt sort_order', () => {
    const m = computeWidgetModel(
      raw({
        habits: [habit('b', 'Zweite', 'blue', 2), habit('a', 'Erste', 'green', 1)],
        completions: [{ ...comp('a', TODAY), deleted_at: '2026-11-19T08:00:00Z' }],
      }),
      TODAY,
    )
    expect(m.segments.map((s) => s.name)).toEqual(['Erste', 'Zweite'])
    expect(m.done).toBe(0)
  })

  it('leerer Zustand', () => {
    const m = computeWidgetModel(raw(), TODAY)
    expect(m).toMatchObject({ done: 0, total: 0, optionalOpen: 0, segments: [], weekLine: null })
  })

  it('lange Namen werden in der Wochenzeile gekürzt, mehr als zwei erhalten "…"', () => {
    const mk = (id: string, name: string) => habit(id, name, 'blue', 1, { schedule_type: 'times_per_week', schedule_config: { times: 2 } })
    const m = computeWidgetModel(raw({ habits: [mk('a', 'Sehr langer Gewohnheitsname'), mk('b', 'B'), mk('c', 'C')] }), TODAY)
    expect(m.weekLine).toBe('Diese Woche: Sehr langer… 0/2 · B 0/2 …')
  })
})
