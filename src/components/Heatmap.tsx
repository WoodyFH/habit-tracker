// Heatmap der letzten Wochen: pro Woche eine Spalte (Mo–So), kleine abgerundete Quadrate.
import { useMemo } from 'react'
import { addDays, endOfWeek, formatDateDE } from '../lib/dates'
import { colorHex, onColor } from '../lib/catalog'
import { dayStatus, type HabitContext } from '../lib/schedule'
import type { DateStr } from '../lib/types'

export function Heatmap({
  ctx,
  color,
  today,
  weeks = 14,
}: {
  ctx: HabitContext
  color: string
  today: DateStr
  weeks?: number
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

  return (
    <div className="flex gap-[3px]" role="img" aria-label={`Verlauf der letzten ${weeks} Wochen`}>
      {cols.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {col.map(({ date, status, value }) => {
            let bg = 'var(--soft)'
            let border = 'none'
            if (status === 'done') bg = hex
            else if (status === 'partial') bg = `color-mix(in srgb, ${hex} 38%, var(--soft))`
            else if (status === 'neutral') {
              bg = 'transparent'
              border = '1px dashed var(--line)'
            } else if (status === 'future') {
              bg = 'transparent'
            }
            const relapse = ctx.habit.type === 'quit' && status === 'missed'
            return (
              <span
                key={date}
                title={`${formatDateDE(date)}${value ? ` · ${value}` : ''}`}
                className="grid aspect-square w-full place-items-center rounded-[28%] text-[8px] leading-none font-bold"
                style={{
                  background: bg,
                  border,
                  color: status === 'done' ? onColor(hex) : 'var(--muted)',
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
}
