import { useMemo } from 'react'
import { HabitCard } from '../components/HabitCard'
import { useData } from '../lib/dataContext'
import { colorHex, tint } from '../lib/catalog'
import { todayStatus } from '../lib/todayStatus'
import type { DateStr, Habit } from '../lib/types'

interface Props {
  habits: Habit[]
  filtered: boolean
  onEdit: (h: Habit) => void
  onDay: (h: Habit, date: DateStr) => void
  onHistory: (h: Habit) => void
  onNew: () => void
}

export function CardsView({ habits, filtered, onEdit, onDay, onHistory, onNew }: Props) {
  const data = useData()
  const summary = useMemo(() => todayStatus(habits, data.ctxById, data.today), [habits, data.ctxById, data.today])

  if (habits.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-xs space-y-4 text-center">
        <p className="text-lg font-bold">{filtered ? 'Nichts gefunden' : 'Noch keine Gewohnheiten'}</p>
        <p className="text-sm leading-relaxed text-muted">
          {filtered ? 'Mit den aktuellen Filtern gibt es keine Treffer. Passe den Filter an.' : 'Lege deine erste Gewohnheit an und starte mit dem ersten Haken.'}
        </p>
        {!filtered && (
          <button type="button" onClick={onNew} className="press h-12 rounded-2xl bg-[#6366f1] px-6 font-semibold text-white">
            Erste Gewohnheit anlegen
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {summary.segments.length > 0 && (
        <div className="rounded-3xl bg-card px-4 py-3 shadow-card" role="status" aria-label={`Heute ${summary.done} von ${summary.total} erledigt`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">
              {summary.total > 0 && summary.done === summary.total ? 'Alles erledigt 🎉' : 'Heute'}
              {summary.optionalOpen > 0 && <span className="ml-2 text-xs font-medium text-muted">+ {summary.optionalOpen} optional</span>}
            </span>
            <span className="text-sm font-bold tabular-nums">{summary.total > 0 ? `${summary.done} von ${summary.total}` : 'nichts Pflicht'}</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {summary.segments.map((s) => {
              const hex = colorHex(s.color)
              // erledigt: volle Farbe · verpflichtend offen: weiß mit Rahmen · optional (Wochen-/Monatsziel): ganz hell
              const style =
                s.kind === 'done'
                  ? { background: hex }
                  : s.kind === 'required'
                    ? { background: 'var(--card)', boxShadow: `inset 0 0 0 1.5px ${tint(hex, 55)}` }
                    : { background: tint(hex, 12) }
              return <span key={s.habitId} className="h-2 min-w-1.5 flex-1 rounded-full transition-colors duration-300" style={style} />
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {habits.map((h) => {
          const ctx = data.ctxById.get(h.id)
          if (!ctx) return null
          return <HabitCard key={h.id} habit={h} ctx={ctx} today={data.today} onEdit={() => onEdit(h)} onDay={(d) => onDay(h, d)} onHistory={() => onHistory(h)} />
        })}
      </div>
    </div>
  )
}
