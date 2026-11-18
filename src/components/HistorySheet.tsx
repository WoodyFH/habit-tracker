// Verlauf als Monatskalender: vergangene Tage antippen, um sie nachzutragen oder zu korrigieren.
// Liegt ein Tag vor dem Startdatum, wird der Start automatisch auf diesen Tag vorgezogen.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { colorHex } from '../lib/catalog'
import { useData } from '../lib/dataContext'
import { addDays, addMonthsToFirst, endOfMonth, formatDateDE, isoWeekday, MONTH_NAMES, parseDate, startOfMonth, WEEKDAY_SHORT } from '../lib/dates'
import { toggleDay } from '../lib/repo'
import { dayStatus } from '../lib/schedule'
import type { DateStr, Habit } from '../lib/types'
import { DayCell } from './DayCell'
import { HabitIcon } from './HabitIcon'
import { Sheet } from './Sheet'
import { statusLabel } from '../views/WeekView'

interface Props {
  habit: Habit | null
  onClose: () => void
  onDay: (habit: Habit, date: DateStr) => void
}

export function HistorySheet({ habit, onClose, onDay }: Props) {
  if (!habit) return null
  return <Inner key={habit.id} habit={habit} onClose={onClose} onDay={onDay} />
}

function Inner({ habit, onClose, onDay }: { habit: Habit; onClose: () => void; onDay: (h: Habit, d: DateStr) => void }) {
  const data = useData()
  // aktuelle Daten der Gewohnheit (das übergebene Objekt kann veraltet sein, z. B. nach vorgezogenem Start)
  const live = data.habits.find((h) => h.id === habit.id) ?? habit
  const ctx = data.ctxById.get(habit.id)
  const [month, setMonth] = useState(startOfMonth(data.today))
  const hex = colorHex(live.color)
  const isCounter = live.type === 'build' && live.tracking_mode === 'counter'

  if (!ctx) return null

  const first = startOfMonth(month)
  const lead = isoWeekday(first) - 1
  const total = parseDate(endOfMonth(month)).d
  const cells: Array<DateStr | null> = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => addDays(first, i))]
  const { y, m } = parseDate(first)
  const isCurrent = month === startOfMonth(data.today)

  return (
    <Sheet open onClose={onClose} title={live.name} size="tall">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-card">
          <HabitIcon icon={live.icon} color={live.color} size={40} />
          <div className="min-w-0 text-[13px] leading-snug text-muted">
            Tippe auf einen Tag, um ihn zu markieren oder zu ändern – auch rückwirkend. Lange drücken für Wert und Notiz.
            {' '}Start: {formatDateDE(live.start_date)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" aria-label="Voriger Monat" onClick={() => setMonth(addMonthsToFirst(month, -1))} className="press grid size-10 place-items-center rounded-full bg-card shadow-card">
            <ChevronLeft size={18} />
          </button>
          <div className="text-[16px] font-bold">
            {MONTH_NAMES[m - 1]} {y}
          </div>
          <button
            type="button"
            aria-label="Nächster Monat"
            disabled={isCurrent}
            onClick={() => setMonth(addMonthsToFirst(month, 1))}
            className="press grid size-10 place-items-center rounded-full bg-card shadow-card disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="rounded-3xl bg-card p-3 shadow-card">
          <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold text-muted uppercase">
            {WEEKDAY_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-2">
            {cells.map((date, i) =>
              date === null ? (
                <div key={`e${i}`} />
              ) : (
                <div key={date} className="flex flex-col items-center gap-0.5">
                  <DayCell
                    status={dayStatus(ctx, date, data.today)}
                    color={hex}
                    size={38}
                    radius={13}
                    isToday={date === data.today}
                    value={isCounter ? (ctx.values.get(date) ?? 0) : undefined}
                    showValue={isCounter}
                    relapse={live.type === 'quit'}
                    label={`${formatDateDE(date)}: ${statusLabel(dayStatus(ctx, date, data.today), live)}`}
                    onTap={date > data.today ? undefined : () => void toggleDay(live, date, ctx.values.get(date) ?? 0)}
                    onLongPress={date > data.today ? undefined : () => onDay(live, date)}
                  />
                  <span className="text-[10px] leading-none text-muted tabular-nums">{parseDate(date).d}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
