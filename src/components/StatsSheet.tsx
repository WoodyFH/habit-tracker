// Statistik (einfach): pro Gewohnheit Serien, Erfolgsquote, Gesamtanzahl – plus Gesamtübersicht.
import { useMemo } from 'react'
import { useData } from '../lib/dataContext'
import { computeOverall } from '../lib/overall'
import type { HabitStats } from '../lib/streaks'
import { HabitIcon } from './HabitIcon'
import { streakText } from './HabitCard'
import { Sheet } from './Sheet'

const pct = (v: number | null) => (v === null ? '–' : `${v} %`)

export function StatsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData()
  const overall = useMemo(() => computeOverall(data.habits, data.ctxById, data.today), [data.habits, data.ctxById, data.today])

  return (
    <Sheet open={open} onClose={onClose} title="Statistik" size="tall">
      {data.habits.length === 0 ? (
        <p className="py-8 text-center text-muted">Lege eine Gewohnheit an, dann erscheint hier deine Statistik.</p>
      ) : (
        <div className="space-y-6">
          <section aria-label="Gesamtübersicht" className="grid grid-cols-2 gap-3">
            <Tile label="Heute erledigt" value={overall.dueToday ? `${overall.doneToday} / ${overall.dueToday}` : '–'} />
            <Tile label="Erfolgsquote 30 Tage" value={pct(overall.avgRate30)} />
            <Tile label="Aktive Gewohnheiten" value={String(overall.habits)} />
            <Tile label="Erledigungen gesamt" value={overall.totalCheckins.toLocaleString('de-AT')} />
            {overall.best && (
              <div className="col-span-2 rounded-3xl bg-soft p-4">
                <div className="text-xs font-semibold tracking-wide text-muted uppercase">Längste aktuelle Serie</div>
                <div className="mt-1 text-lg font-bold">
                  {overall.best.name} · {streakText(overall.best.value, overall.best.unit)}
                </div>
              </div>
            )}
          </section>

          <section aria-label="Pro Gewohnheit" className="space-y-3">
            {data.habits.map((h) => {
              const s = overall.perHabit.get(h.id)
              if (!s) return null
              return (
                <div key={h.id} className={`rounded-3xl bg-soft p-4 ${h.archived ? 'opacity-60' : ''}`}>
                  <div className="mb-3 flex items-center gap-3">
                    <HabitIcon icon={h.icon} color={h.color} size={36} />
                    <div className="min-w-0 flex-1 truncate font-bold">{h.name}</div>
                    {h.archived && <span className="text-xs text-muted">Archiviert</span>}
                  </div>
                  <StatGrid s={s} quit={h.type === 'quit'} />
                </div>
              )
            })}
          </section>
        </div>
      )}
    </Sheet>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-soft p-4">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function StatGrid({ s, quit }: { s: HabitStats; quit: boolean }) {
  const items: Array<[string, string]> = [
    ['Aktuelle Serie', streakText(s.current, s.unit)],
    ['Längste Serie', streakText(s.longest, s.unit)],
    ['Erfolgsquote 30 Tage', pct(s.rate30)],
    ['Erfolgsquote gesamt', pct(s.rateTotal)],
    [quit ? 'Tage ohne Rückfall' : 'Gesamtanzahl', String(s.total)],
  ]
  if (quit) items.push(['Rückfälle', String(s.relapses)])
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{k}</dt>
          <dd className="text-[17px] font-bold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
