import { ArchiveRestore, Check, Circle, Flame, Minus, NotebookPen, Plus, RotateCcw, ShieldX } from 'lucide-react'
import { memo, useMemo } from 'react'
import { colorHex, onColor } from '../lib/catalog'
import { formatDayMonth } from '../lib/dates'
import { bumpCounter, setArchived, setCompletion } from '../lib/repo'
import { counterTarget, describeSchedule, todayInfo, type HabitContext } from '../lib/schedule'
import { computeStreaks, type StreakUnit } from '../lib/streaks'
import type { DateStr, Habit } from '../lib/types'
import { Heatmap } from './Heatmap'
import { HabitIcon } from './HabitIcon'
import { cx } from './ui'

export function streakText(n: number, unit: StreakUnit): string {
  if (unit === 'days') return `${n} ${n === 1 ? 'Tag' : 'Tage'}`
  if (unit === 'weeks') return `${n} ${n === 1 ? 'Woche' : 'Wochen'}`
  return `${n} ${n === 1 ? 'Monat' : 'Monate'}`
}

interface Props {
  habit: Habit
  ctx: HabitContext
  today: DateStr
  categoryNames: string[]
  onEdit: () => void
  onDay: (date: DateStr) => void
}

export const HabitCard = memo(function HabitCard({ habit, ctx, today, categoryNames, onEdit, onDay }: Props) {
  const hex = colorHex(habit.color)
  const fg = onColor(hex)
  const info = useMemo(() => todayInfo(ctx, today), [ctx, today])
  const streak = useMemo(() => computeStreaks(ctx, today), [ctx, today])
  const value = ctx.values.get(today) ?? 0
  const isCounter = habit.type === 'build' && habit.tracking_mode === 'counter'
  const target = counterTarget(habit)
  const unit = habit.unit ?? ''

  const disabled = info.state === 'paused' || info.state === 'notstarted' || info.state === 'ended'
  const done = info.state === 'done'
  const dimmed = habit.archived || info.state === 'ended' || info.state === 'notstarted'

  return (
    <article className={cx('rounded-[28px] bg-card p-4 shadow-card', dimmed && 'opacity-70')} aria-label={habit.name}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEdit} className="press flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${habit.name} bearbeiten`}>
          <HabitIcon icon={habit.icon} color={habit.color} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] leading-tight font-bold">{habit.name}</span>
            <span className="mt-0.5 block truncate text-[13px] text-muted">
              {habit.archived ? 'Archiviert' : info.label}
              {!habit.archived && habit.type === 'build' && <> · {describeSchedule(habit)}</>}
              {habit.type === 'quit' && streak.current > 0 && !habit.archived && info.state !== 'paused' && <> · {streakText(streak.current, 'days')}</>}
            </span>
          </span>
        </button>
        {streak.current > 0 && habit.type === 'build' && (
          <span
            className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 text-[13px] font-bold tabular-nums"
            title="Aktuelle Serie"
          >
            <Flame size={15} className="text-[#f97316]" fill="#f97316" />
            {streakText(streak.current, streak.unit)}
          </span>
        )}
        {!habit.archived && (
          <button
            type="button"
            aria-label="Notiz für heute"
            title="Notiz / Wert für heute"
            onClick={() => onDay(today)}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-soft text-muted"
          >
            <NotebookPen size={15} />
          </button>
        )}
      </div>

      {categoryNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categoryNames.map((n) => (
            <span key={n} className="rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Aktion */}
      <div className="mt-3.5">
        {habit.archived ? (
          <button
            type="button"
            onClick={() => setArchived(habit.id, false)}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-soft text-[15px] font-bold"
          >
            <ArchiveRestore size={20} /> Wiederherstellen
          </button>
        ) : habit.type === 'quit' ? (
          <QuitAction habit={habit} state={info.state} disabled={disabled} hex={hex} fg={fg} today={today} onDay={onDay} />
        ) : isCounter ? (
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              aria-label="Eins weniger"
              disabled={disabled || value <= 0}
              onClick={() => bumpCounter(habit.id, today, value, -1)}
              className="press grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-soft disabled:opacity-40"
            >
              <Minus size={22} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => bumpCounter(habit.id, today, value, 1)}
              onContextMenu={(e) => {
                e.preventDefault()
                onDay(today)
              }}
              aria-label={`${value} von ${target} ${unit}. Eins mehr`}
              className="press relative flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-soft text-[16px] font-bold disabled:opacity-60"
            >
              <span
                className="absolute inset-y-0 left-0 transition-all duration-300"
                style={{ width: `${Math.min(100, (value / target) * 100)}%`, background: hex }}
              />
              <span className="relative tabular-nums" style={{ color: done || value / target > 0.55 ? fg : 'var(--ink)' }}>
                {done && <Check size={18} className="mr-1.5 inline -mt-0.5" strokeWidth={3} />}
                {formatNum(value)} / {formatNum(target)} {unit}
              </span>
            </button>
            <button
              type="button"
              aria-label="Eins mehr"
              disabled={disabled}
              onClick={() => bumpCounter(habit.id, today, value, 1)}
              className="press grid h-14 w-14 shrink-0 place-items-center rounded-2xl disabled:opacity-40"
              style={{ background: hex, color: fg }}
            >
              <Plus size={22} strokeWidth={2.6} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCompletion(habit.id, today, done ? 0 : 1)}
            className={cx('press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold disabled:opacity-50', done && 'anim-pop')}
            style={done ? { background: hex, color: fg } : { background: 'var(--soft)', color: 'var(--ink)' }}
            aria-pressed={done}
          >
            {done ? <Check size={22} strokeWidth={3} /> : <Circle size={22} strokeWidth={2.6} style={{ color: hex }} />}
            {info.state === 'paused'
              ? 'Pausiert'
              : info.state === 'notstarted'
                ? `Startet am ${formatDayMonth(habit.start_date)}`
                : info.state === 'ended'
                  ? 'Beendet'
                  : done
                    ? 'Erledigt'
                    : info.state === 'rest'
                      ? 'Trotzdem abhaken'
                      : 'Abhaken'}
          </button>
        )}
      </div>

      {info.progress && !habit.archived && (
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.min(info.progress.target, 14) }, (_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: i < info.progress!.count ? hex : 'var(--soft)' }}
            />
          ))}
        </div>
      )}

      <div className="mt-3.5">
        <Heatmap ctx={ctx} color={habit.color} today={today} />
      </div>
    </article>
  )
})

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('de-AT', { maximumFractionDigits: 1 })
}

function QuitAction({
  habit,
  state,
  disabled,
  hex,
  fg,
  today,
  onDay,
}: {
  habit: Habit
  state: string
  disabled: boolean
  hex: string
  fg: string
  today: DateStr
  onDay: (d: DateStr) => void
}) {
  const relapsed = state === 'relapse'
  if (disabled) {
    return <div className="grid h-14 place-items-center rounded-2xl bg-soft text-[15px] font-bold text-muted">{state === 'paused' ? 'Pausiert' : state === 'ended' ? 'Beendet' : 'Noch nicht gestartet'}</div>
  }
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-bold"
        style={relapsed ? { background: 'var(--soft)', color: 'var(--muted)' } : { background: hex, color: fg }}
      >
        {relapsed ? <ShieldX size={22} /> : <Check size={22} strokeWidth={3} />}
        {relapsed ? 'Rückfall eingetragen' : 'Heute sauber'}
      </div>
      <button
        type="button"
        onClick={() => {
          if (relapsed) void setCompletion(habit.id, today, 0)
          else void setCompletion(habit.id, today, 1)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onDay(today)
        }}
        className="press flex h-14 shrink-0 items-center gap-1.5 rounded-2xl bg-soft px-4 text-sm font-bold"
      >
        {relapsed ? (
          <>
            <RotateCcw size={16} /> Rückgängig
          </>
        ) : (
          'Rückfall'
        )}
      </button>
    </div>
  )
}
