// Hilfsfunktionen nur für Tests.
import { eachDay } from './dates'
import { makeContext, type HabitContext } from './schedule'
import type { Completion, DateStr, HabitLogic } from './types'

export function habit(over: Partial<HabitLogic> = {}): HabitLogic {
  return {
    type: 'build',
    tracking_mode: 'yes_no',
    target_value: null,
    schedule_type: 'daily',
    schedule_config: {},
    start_date: '2026-01-01',
    end_date: null,
    ...over,
  }
}

/** entries: Liste von Daten (Wert 1) oder [Datum, Wert]. */
export function ctx(
  h: HabitLogic,
  entries: Array<DateStr | [DateStr, number]> = [],
  pauses: Array<[DateStr, DateStr]> = [],
): HabitContext {
  const comps: Pick<Completion, 'date' | 'value' | 'deleted_at'>[] = entries.map((e) =>
    typeof e === 'string' ? { date: e, value: 1, deleted_at: null } : { date: e[0], value: e[1], deleted_at: null },
  )
  return makeContext(
    h,
    comps,
    pauses.map(([from_date, to_date]) => ({ from_date, to_date, deleted_at: null })),
  )
}

export const range = eachDay
