// Tabelle: kompakte Übersicht über viele Tage oder Wochen, horizontal scrollbar, erste Spalte bleibt stehen.
import { useEffect, useMemo, useRef } from 'react'
import { DayCell } from '../components/DayCell'
import { HabitIcon } from '../components/HabitIcon'
import { Segmented } from '../components/ui'
import { colorHex } from '../lib/catalog'
import { useData } from '../lib/dataContext'
import { addDays, dayOfMonth, endOfWeek, formatDayMonth, isoWeekNumber, isoWeekday, MONTH_SHORT, parseDate, startOfWeek, WEEKDAY_SHORT } from '../lib/dates'
import { toggleDay } from '../lib/repo'
import { countDoneIn, dayStatus, isDone, isPeriodic, isRelapse, isScheduledDay, periodInfo, type DayStatus, type HabitContext } from '../lib/schedule'
import type { Prefs } from '../lib/prefs'
import type { DateStr, Habit } from '../lib/types'
import { statusLabel } from './WeekView'

interface Props {
  habits: Habit[]
  prefs: Prefs
  update: (p: Partial<Prefs>) => void
  onEdit: (h: Habit) => void
  onDay: (h: Habit, date: DateStr) => void
}

const DAY_COUNT = 63 // 9 Wochen
const WEEK_COUNT = 20

/** Wochenzelle: fasst eine Woche zusammen (Anzahl erledigter Tage + Farbe nach Zielerreichung). */
function weekCell(ctx: HabitContext, weekStart: DateStr, today: DateStr): { status: DayStatus; count: number } {
  const to = endOfWeek(weekStart)
  if (weekStart > today) return { status: 'future', count: 0 }
  const h = ctx.habit
  const upTo = to < today ? to : today

  if (h.type === 'quit') {
    let relapses = 0
    for (let d = weekStart; d <= upTo; d = addDays(d, 1)) if (isRelapse(ctx, d)) relapses++
    return { status: relapses > 0 ? 'missed' : 'done', count: relapses }
  }

  const count = countDoneIn(ctx, weekStart, upTo)
  if (isPeriodic(h)) {
    const p = periodInfo(ctx, weekStart, today)
    if (h.schedule_type === 'times_per_week') {
      if (p.neutral && count === 0) return { status: 'neutral', count }
      if (p.met) return { status: 'done', count }
      if (count > 0) return { status: 'partial', count }
      return { status: p.closed ? 'missed' : 'open', count }
    }
    return { status: count > 0 ? 'partial' : 'open', count }
  }

  let scheduled = 0
  let done = 0
  for (let d = weekStart; d <= upTo; d = addDays(d, 1)) {
    if (!isScheduledDay(ctx, d)) continue
    if (d === today && !isDone(ctx, d)) continue
    scheduled++
    if (isDone(ctx, d)) done++
  }
  if (scheduled === 0 && count === 0) return { status: 'neutral', count }
  if (scheduled > 0 && done >= scheduled) return { status: 'done', count }
  if (count > 0) return { status: 'partial', count }
  return { status: 'missed', count }
}

export function TableView({ habits, prefs, update, onEdit, onDay }: Props) {
  const data = useData()
  const scroller = useRef<HTMLDivElement>(null)
  const mode = prefs.tableMode

  const columns = useMemo<DateStr[]>(() => {
    if (mode === 'days') return Array.from({ length: DAY_COUNT }, (_, i) => addDays(data.today, i - (DAY_COUNT - 1)))
    const thisWeek = startOfWeek(data.today)
    return Array.from({ length: WEEK_COUNT }, (_, i) => addDays(thisWeek, -7 * (WEEK_COUNT - 1 - i)))
  }, [mode, data.today])

  // Nach rechts scrollen (heute / aktuelle Woche sichtbar)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [mode, columns, habits.length])

  const cell = mode === 'days' ? 30 : 38
  const gap = 4
  const nameW = 132

  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-[240px]">
        <Segmented
          label="Ansicht"
          value={mode}
          onChange={(v) => update({ tableMode: v })}
          options={[
            { value: 'days', label: 'Tage' },
            { value: 'weeks', label: 'Wochen' },
          ]}
        />
      </div>

      <div className="rounded-3xl bg-card shadow-card">
        {habits.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Keine Gewohnheiten zum Anzeigen.</p>
        ) : (
          <div ref={scroller} className="no-scrollbar overflow-x-auto overscroll-x-contain rounded-3xl" tabIndex={0} aria-label="Tabelle, horizontal scrollbar">
            <table className="border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-card" style={{ minWidth: nameW, width: nameW }} />
                  {columns.map((d, i) => {
                    const monthStart = mode === 'days' ? dayOfMonth(d) === 1 || i === 0 : dayOfMonth(d) <= 7
                    const isMonday = isoWeekday(d) === 1
                    const isToday = mode === 'days' ? d === data.today : d === startOfWeek(data.today)
                    return (
                      <th
                        key={d}
                        className="pb-1.5 align-bottom font-normal"
                        style={{ minWidth: cell + gap, paddingLeft: mode === 'days' && isMonday && i > 0 ? gap + 4 : 0 }}
                      >
                        <div className="h-3.5 text-left text-[10px] font-semibold whitespace-nowrap text-muted">{monthStart ? MONTH_SHORT[parseDate(d).m - 1] : ''}</div>
                        {mode === 'days' ? (
                          <div className="text-center leading-tight" style={{ width: cell }}>
                            <div className={`text-[10px] font-semibold uppercase ${isToday ? 'text-ink' : 'text-muted'}`}>{WEEKDAY_SHORT[isoWeekday(d) - 1]}</div>
                            <div className={`text-[12px] font-bold tabular-nums ${isToday ? 'text-ink' : 'text-muted'}`}>{dayOfMonth(d)}</div>
                          </div>
                        ) : (
                          <div className="text-center leading-tight" style={{ width: cell }}>
                            <div className={`text-[10px] font-semibold ${isToday ? 'text-ink' : 'text-muted'}`}>KW{isoWeekNumber(d)}</div>
                            <div className={`text-[11px] font-bold tabular-nums ${isToday ? 'text-ink' : 'text-muted'}`}>{dayOfMonth(d)}.</div>
                          </div>
                        )}
                      </th>
                    )
                  })}
                  <th style={{ minWidth: 12 }} />
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const ctx = data.ctxById.get(h.id)
                  if (!ctx) return null
                  const hex = colorHex(h.color)
                  const isCounter = h.type === 'build' && h.tracking_mode === 'counter'
                  return (
                    <tr key={h.id} className={h.archived ? 'opacity-60' : ''}>
                      <th scope="row" className="sticky left-0 z-10 bg-card py-1 pr-2 pl-3 text-left font-normal" style={{ minWidth: nameW, width: nameW }}>
                        <button type="button" onClick={() => onEdit(h)} className="press flex w-full min-w-0 items-center gap-2 text-left" aria-label={`${h.name} bearbeiten`}>
                          <HabitIcon icon={h.icon} color={h.color} size={28} soft />
                          <span className="min-w-0 flex-1 truncate text-[12px] leading-tight font-semibold">{h.name}</span>
                        </button>
                      </th>
                      {columns.map((d, i) => {
                        const pad = mode === 'days' && isoWeekday(d) === 1 && i > 0 ? gap + 4 : 0
                        if (mode === 'weeks') {
                          const w = weekCell(ctx, d, data.today)
                          return (
                            <td key={d} className="py-[2px]" style={{ paddingRight: gap }}>
                              <DayCell
                                status={w.status}
                                color={hex}
                                size={cell}
                                radius={11}
                                isToday={d === startOfWeek(data.today)}
                                value={w.count}
                                showValue={h.type !== 'quit'}
                                relapse={h.type === 'quit'}
                                label={`${h.name}, Woche ab ${formatDayMonth(d)}: ${w.count} ${h.type === 'quit' ? 'Rückfälle' : 'erledigt'}`}
                              />
                            </td>
                          )
                        }
                        const status = dayStatus(ctx, d, data.today)
                        const value = ctx.values.get(d) ?? 0
                        const disabled = d > data.today || h.archived
                        return (
                          <td key={d} className="py-[2px]" style={{ paddingLeft: pad, paddingRight: gap }}>
                            <DayCell
                              status={status}
                              color={hex}
                              size={cell}
                              radius={9}
                              isToday={d === data.today}
                              value={isCounter ? value : undefined}
                              showValue={isCounter}
                              relapse={h.type === 'quit'}
                              label={`${h.name}, ${formatDayMonth(d)}: ${statusLabel(status, h)}`}
                              onTap={disabled ? undefined : () => void toggleDay(h, d, value)}
                              onLongPress={disabled ? undefined : () => onDay(h, d)}
                            />
                          </td>
                        )
                      })}
                      <td />
                    </tr>
                  )
                })}
                <tr aria-hidden="true">
                  <td className="sticky left-0 z-10 h-2 bg-card" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="px-2 text-center text-xs text-muted">
        {mode === 'days' ? 'Tippen schaltet den Tag um · lange drücken für Wert und Notiz' : 'Wochenzellen zeigen die Zahl erledigter Tage; gefüllt = Wochenziel erreicht'}
      </p>
    </div>
  )
}
