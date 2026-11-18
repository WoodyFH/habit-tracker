import { ArchiveRestore, Check, Flame, Minus, Plus, X } from 'lucide-react'
import { memo, useMemo } from 'react'
import { colorHex, onColor, tint } from '../lib/catalog'
import { formatDayMonth } from '../lib/dates'
import { bumpCounter, setArchived, setCompletion } from '../lib/repo'
import { counterTarget, describeSchedule, todayInfo, type HabitContext } from '../lib/schedule'
import { computeStreaks, type StreakUnit } from '../lib/streaks'
import type { DateStr, Habit } from '../lib/types'
import { useLongPress } from './DayCell'
import { Heatmap } from './Heatmap'
import { HabitIcon } from './HabitIcon'
import { cx } from './ui'

export function streakText(n: number, unit: StreakUnit): string {
  if (unit === 'days') return `${n} ${n === 1 ? 'Tag' : 'Tage'}`
  if (unit === 'weeks') return `${n} ${n === 1 ? 'Woche' : 'Wochen'}`
  return `${n} ${n === 1 ? 'Monat' : 'Monate'}`
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('de-AT', { maximumFractionDigits: 1 })
}

interface Props {
  habit: Habit
  ctx: HabitContext
  today: DateStr
  onEdit: () => void
  onDay: (date: DateStr) => void
  onHistory: () => void
}

export const HabitCard = memo(function HabitCard({ habit, ctx, today, onEdit, onDay, onHistory }: Props) {
  const hex = colorHex(habit.color)
  const fg = onColor(hex)
  const info = useMemo(() => todayInfo(ctx, today), [ctx, today])
  const streak = useMemo(() => computeStreaks(ctx, today), [ctx, today])
  const value = ctx.values.get(today) ?? 0
  const isCounter = habit.type === 'build' && habit.tracking_mode === 'counter'
  const isQuit = habit.type === 'quit'
  const target = counterTarget(habit)

  const disabled = info.state === 'paused' || info.state === 'notstarted' || info.state === 'ended'
  const done = info.state === 'done'
  const relapsed = info.state === 'relapse'
  const dimmed = habit.archived || info.state === 'ended' || info.state === 'notstarted'

  // Hauptbutton: Tippen = abhaken, langes Drücken = Wert & Notiz
  const press = useLongPress(
    () => onDay(today),
    () => {
      if (disabled) return
      if (isCounter) void bumpCounter(habit.id, today, value, 1)
      else if (isQuit) void setCompletion(habit.id, today, relapsed ? 0 : 1)
      else void setCompletion(habit.id, today, done ? 0 : 1)
    },
  )

  const subtitle =
    habit.archived
      ? 'Archiviert'
      : info.state === 'notstarted'
        ? `Startet am ${formatDayMonth(habit.start_date)}`
        : info.label

  const mainLabel = isQuit
    ? relapsed
      ? 'Rückfall eingetragen – tippen zum Rückgängigmachen'
      : 'Heute sauber – tippen für Rückfall'
    : isCounter
      ? `${formatNum(value)} von ${formatNum(target)}. Eins mehr`
      : done
        ? 'Erledigt – tippen zum Rückgängigmachen'
        : 'Abhaken'

  return (
    <article
      className={cx('rounded-3xl p-3.5 shadow-card', dimmed && 'opacity-70')}
      style={{ background: `linear-gradient(180deg, ${tint(hex, 8)} 0%, var(--card) 70%)` }}
      aria-label={habit.name}
    >
      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="press flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${habit.name} bearbeiten`}>
          <HabitIcon icon={habit.icon} color={habit.color} size={44} soft />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] leading-tight font-bold">{habit.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-muted">
              {streak.current > 0 && !habit.archived && (
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-ink">
                  <Flame size={12} className="text-[#f97316]" fill="#f97316" />
                  {streakText(streak.current, streak.unit)}
                </span>
              )}
              <span className="truncate">
                {streak.current > 0 && !habit.archived ? '· ' : ''}
                {subtitle}
                {!habit.archived && !isQuit && info.state !== 'notstarted' && <> · {describeSchedule(habit)}</>}
              </span>
            </span>
          </span>
        </button>

        {habit.archived ? (
          <button
            type="button"
            onClick={() => setArchived(habit.id, false)}
            aria-label="Wiederherstellen"
            className="press grid size-12 shrink-0 place-items-center rounded-2xl bg-soft text-ink"
          >
            <ArchiveRestore size={20} />
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            {isCounter && (
              <button
                type="button"
                aria-label="Eins weniger"
                disabled={disabled || value <= 0}
                onClick={() => bumpCounter(habit.id, today, value, -1)}
                className="press grid size-9 place-items-center rounded-xl text-ink disabled:opacity-30"
                style={{ background: tint(hex, 14) }}
              >
                <Minus size={17} />
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={mainLabel}
              aria-pressed={isCounter ? undefined : isQuit ? !relapsed : done}
              {...press}
              className={cx('press no-select relative grid h-12 place-items-center overflow-hidden rounded-2xl font-bold disabled:opacity-40', isCounter ? 'min-w-[56px] px-1.5' : 'w-12', done && !isCounter && 'anim-pop')}
              style={
                isCounter
                  ? { background: tint(hex, 16), color: 'var(--ink)' }
                  : relapsed
                    ? { background: 'var(--soft)', color: 'var(--muted)' }
                    : done || isQuit
                      ? { background: hex, color: fg }
                      : { background: tint(hex, 18), color: hex }
              }
            >
              {isCounter ? (
                <>
                  <span className="absolute inset-y-0 left-0 transition-all duration-300" style={{ width: `${Math.min(100, (value / target) * 100)}%`, background: hex }} />
                  <span className="relative text-[14px] leading-tight tabular-nums" style={{ color: value / target > 0.5 ? fg : 'var(--ink)' }}>
                    {formatNum(value)}
                    <span className="opacity-70">/{formatNum(target)}</span>
                    {habit.unit && <span className="block text-[9.5px] font-semibold opacity-75">{habit.unit}</span>}
                  </span>
                </>
              ) : relapsed ? (
                <X size={22} strokeWidth={3} />
              ) : (
                <Check size={24} strokeWidth={3} />
              )}
            </button>
            {isCounter && (
              <button
                type="button"
                aria-label="Eins mehr"
                disabled={disabled}
                onClick={() => bumpCounter(habit.id, today, value, 1)}
                className="press grid size-9 place-items-center rounded-xl disabled:opacity-30"
                style={{ background: hex, color: fg }}
              >
                <Plus size={18} strokeWidth={2.8} />
              </button>
            )}
          </div>
        )}
      </div>

      {info.progress && !habit.archived && (
        <div className="mt-2.5 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: Math.min(info.progress.target, 14) }, (_, i) => (
            <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < info.progress!.count ? hex : tint(hex, 16) }} />
          ))}
        </div>
      )}

      <div className="mt-3">
        <Heatmap ctx={ctx} color={habit.color} today={today} onOpen={onHistory} />
      </div>
    </article>
  )
})
