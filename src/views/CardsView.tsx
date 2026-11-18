import { useMemo } from 'react'
import { HabitCard } from '../components/HabitCard'
import { useData } from '../lib/dataContext'
import { todayInfo } from '../lib/schedule'
import type { DateStr, Habit } from '../lib/types'

interface Props {
  habits: Habit[]
  filtered: boolean
  onEdit: (h: Habit) => void
  onDay: (h: Habit, date: DateStr) => void
  onNew: () => void
}

export function CardsView({ habits, filtered, onEdit, onDay, onNew }: Props) {
  const data = useData()
  const catName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories])

  const summary = useMemo(() => {
    let due = 0
    let done = 0
    for (const h of habits) {
      if (h.archived) continue
      const ctx = data.ctxById.get(h.id)
      if (!ctx) continue
      const info = todayInfo(ctx, data.today)
      if (info.dueToday) {
        due++
        if (info.state === 'done') done++
      }
    }
    return { due, done }
  }, [habits, data.ctxById, data.today])

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
    <div className="space-y-4">
      {summary.due > 0 && (
        <div className="rounded-3xl bg-card p-4 shadow-card" role="status">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{summary.done === summary.due ? 'Alles erledigt 🎉' : 'Heute'}</span>
            <span className="text-sm font-bold tabular-nums">
              {summary.done} von {summary.due}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft" aria-hidden="true">
            <div className="h-full rounded-full bg-[#6366f1] transition-all duration-500" style={{ width: `${(summary.done / summary.due) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {habits.map((h) => {
          const ctx = data.ctxById.get(h.id)
          if (!ctx) return null
          const names = (data.categoryIdsByHabit.get(h.id) ?? []).map((id) => catName.get(id)).filter(Boolean) as string[]
          return <HabitCard key={h.id} habit={h} ctx={ctx} today={data.today} categoryNames={names} onEdit={() => onEdit(h)} onDay={(d) => onDay(h, d)} />
        })}
      </div>
    </div>
  )
}
