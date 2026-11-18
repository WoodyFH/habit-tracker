// Heatmap der letzten Wochen: pro Woche eine Spalte (Mo–So), kleine abgerundete Quadrate.
// Leere Felder tragen einen hellen Ton der Gewohnheitsfarbe. Antippen öffnet den Kalender zum Nachtragen.
import { useMemo } from 'react'
import { addDays, endOfWeek, formatDateDE } from '../lib/dates'
import { cellLook, colorHex } from '../lib/catalog'
import { dayStatus, type HabitContext } from '../lib/schedule'
import type { DateStr } from '../lib/types'

export function Heatmap({
  ctx,
  color,
  today,
  weeks = 26,
  onOpen,
}: {
  ctx: HabitContext
  color: string
  today: DateStr
  weeks?: number
  onOpen?: () => void
}) {
  const hex = colorHex(color)
  const cols = useMemo(() => {
    const lastMonday = addDays(endOfWeek(today), -6)
    const firstMonday = addDays(lastMonday, -7 * (weeks - 1))
    return Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(firstMonday, w * 7 + d)
        return { date, status: dayStatus(ctx, date, today), value: ctx.values.get(date) ?? 0 }
      }),
    )
  }, [ctx, today, weeks])

  const body = (
    <div className="flex gap-[2.5px]" aria-hidden={onOpen ? undefined : true}>
      {cols.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-[2.5px]">
          {col.map(({ date, status, value }) => {
            const look = cellLook(status, hex)
            const relapse = ctx.habit.type === 'quit' && status === 'missed'
            const beforeStart = date < ctx.habit.start_date
            return (
              <span
                key={date}
                title={`${formatDateDE(date)}${value ? ` · ${value}` : ''}`}
                className="grid aspect-square w-full place-items-center rounded-[32%] text-[7px] leading-none font-bold"
                style={{
                  background: beforeStart ? 'transparent' : look.background,
                  border: !beforeStart && status === 'neutral' ? '1px dashed var(--line)' : 'none',
                  color: look.color,
                  outline: date === today ? `1.5px solid ${hex}` : undefined,
                  outlineOffset: date === today ? 1 : undefined,
                }}
              >
                {relapse ? '×' : null}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )

  if (!onOpen) return body
  return (
    <button type="button" onClick={onOpen} aria-label="Verlauf öffnen und Tage nachtragen" className="block w-full text-left active:opacity-80">
      {body}
    </button>
  )
}
