// Wochenliste: Zeile pro Gewohnheit, daneben farbige Felder für die letzten 5–7 Tage (rückwirkend umschaltbar).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DayCell } from '../components/DayCell'
import { HabitIcon } from '../components/HabitIcon'
import { Segmented } from '../components/ui'
import { colorHex } from '../lib/catalog'
import { useData } from '../lib/dataContext'
import { addDays, dayOfMonth, formatDayMonth, isoWeekday, WEEKDAY_SHORT } from '../lib/dates'
import { toggleDay } from '../lib/repo'
import { dayStatus } from '../lib/schedule'
import type { Prefs } from '../lib/prefs'
import type { DateStr, Habit } from '../lib/types'
import { useWidth } from '../lib/useWidth'

interface Props {
  habits: Habit[]
  prefs: Prefs
  update: (p: Partial<Prefs>) => void
  onEdit: (h: Habit) => void
  onDay: (h: Habit, date: DateStr) => void
}

export function WeekView({ habits, prefs, update, onEdit, onDay }: Props) {
  const data = useData()
  const [offset, setOffset] = useState(0) // Tage zurück (0 = Bereich endet heute)
  const [ref, width] = useWidth<HTMLDivElement>()
  const n = prefs.weekDays
  const end = addDays(data.today, -offset)
  const days = Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))

  const gap = 4
  const leftMin = 128
  const cell = Math.max(26, Math.min(40, Math.floor(((width || 340) - 24 - leftMin - gap * (n - 1)) / n)))
  const rangeLabel = `${formatDayMonth(days[0])} – ${formatDayMonth(days[n - 1])}`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Zurück" onClick={() => setOffset((o) => o + n)} className="press grid size-11 place-items-center rounded-full bg-card shadow-card">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-bold">{offset === 0 ? 'Letzte Tage' : rangeLabel}</div>
          {offset === 0 && <div className="text-xs text-muted">{rangeLabel}</div>}
        </div>
        <button
          type="button"
          aria-label="Vor"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - n))}
          className="press grid size-11 place-items-center rounded-full bg-card shadow-card disabled:opacity-40"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mx-auto max-w-[220px]">
        <Segmented
          label="Anzahl Tage"
          value={String(n) as '5' | '6' | '7'}
          onChange={(v) => update({ weekDays: Number(v) as 5 | 6 | 7 })}
          options={[
            { value: '5', label: '5 Tage' },
            { value: '6', label: '6' },
            { value: '7', label: '7' },
          ]}
        />
      </div>

      <div ref={ref} className="rounded-[28px] bg-card p-3 shadow-card">
        {/* Kopfzeile */}
        <div className="flex items-end gap-2 pb-2">
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0" style={{ gap }}>
            {days.map((d) => {
              const isToday = d === data.today
              return (
                <div key={d} className="text-center leading-tight" style={{ width: cell }}>
                  <div className={`text-[10px] font-semibold uppercase ${isToday ? 'text-ink' : 'text-muted'}`}>{WEEKDAY_SHORT[isoWeekday(d) - 1]}</div>
                  <div className={`text-[13px] font-bold tabular-nums ${isToday ? 'text-ink' : 'text-muted'}`}>{dayOfMonth(d)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {habits.length === 0 && <p className="py-10 text-center text-sm text-muted">Keine Gewohnheiten zum Anzeigen.</p>}

        <ul className="divide-y divide-line">
          {habits.map((h) => {
            const ctx = data.ctxById.get(h.id)
            if (!ctx) return null
            const hex = colorHex(h.color)
            const isCounter = h.type === 'build' && h.tracking_mode === 'counter'
            return (
              <li key={h.id} className={`flex items-center gap-2 py-2 ${h.archived ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => onEdit(h)} className="press flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`${h.name} bearbeiten`}>
                  <HabitIcon icon={h.icon} color={h.color} size={34} />
                  <span className="line-clamp-2 min-w-0 text-[13px] leading-tight font-semibold break-words">{h.name}</span>
                </button>
                <div className="flex shrink-0" style={{ gap }}>
                  {days.map((d) => {
                    const status = dayStatus(ctx, d, data.today)
                    const value = ctx.values.get(d) ?? 0
                    const disabled = d < h.start_date || d > data.today || h.archived
                    return (
                      <DayCell
                        key={d}
                        status={status}
                        color={hex}
                        size={cell}
                        isToday={d === data.today}
                        value={isCounter ? value : undefined}
                        showValue={isCounter}
                        relapse={h.type === 'quit'}
                        label={`${h.name}, ${formatDayMonth(d)}: ${statusLabel(status, h)}`}
                        onTap={disabled ? undefined : () => void toggleDay(h, d, value)}
                        onLongPress={disabled ? undefined : () => onDay(h, d)}
                      />
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="px-2 text-center text-xs text-muted">Tippen schaltet den Tag um · lange drücken für Wert und Notiz</p>
    </div>
  )
}

export function statusLabel(status: string, h: Habit): string {
  switch (status) {
    case 'done':
      return h.type === 'quit' ? 'sauber' : 'erledigt'
    case 'partial':
      return 'teilweise'
    case 'missed':
      return h.type === 'quit' ? 'Rückfall' : 'verpasst'
    case 'open':
      return 'offen'
    case 'neutral':
      return 'nicht fällig'
    default:
      return 'Zukunft'
  }
}
