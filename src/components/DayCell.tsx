// Ein Tagesfeld (Wochenliste, Tabelle). Darstellung hängt vom Tagesstatus ab:
//  done → gefüllt in Gewohnheitsfarbe · partial → blass gefüllt · missed/open → graues Feld
//  neutral (nicht fällig / Pause / außerhalb) → gestrichelt, zählt nie als verpasst · future → blass
import { Check, X } from 'lucide-react'
import { useRef } from 'react'
import { cellLook } from '../lib/catalog'
import type { DayStatus } from '../lib/schedule'
import { cx } from './ui'

export function useLongPress(onLong: (() => void) | undefined, onTap: (() => void) | undefined, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const clear = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      if (onLong) {
        timer.current = setTimeout(() => {
          fired.current = true
          if (navigator.vibrate) navigator.vibrate(12)
          onLong()
        }, ms)
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return
      if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false
        return
      }
      onTap?.()
    },
  }
}

interface Props {
  status: DayStatus
  color: string // Hex
  size?: number
  radius?: number
  isToday?: boolean
  /** Zähler: Wert anzeigen */
  value?: number
  showValue?: boolean
  relapse?: boolean
  label: string
  onTap?: () => void
  onLongPress?: () => void
  className?: string
}

export function DayCell({ status, color, size = 36, radius, isToday, value, showValue, relapse, label, onTap, onLongPress, className }: Props) {
  const handlers = useLongPress(onLongPress, onTap)
  const interactive = status !== 'future' && (onTap || onLongPress)
  const r = radius ?? Math.round(size * 0.32)

  const look = cellLook(status, color)

  const content =
    status === 'done' ? (
      showValue && value !== undefined ? (
        <span className="text-[11px] leading-none font-bold tabular-nums">{value}</span>
      ) : (
        <Check size={Math.round(size * 0.5)} strokeWidth={3} />
      )
    ) : status === 'partial' && value !== undefined ? (
      <span className="text-[11px] leading-none font-bold tabular-nums">{value}</span>
    ) : relapse && status === 'missed' ? (
      <X size={Math.round(size * 0.46)} strokeWidth={2.6} />
    ) : null

  const style = {
    width: size,
    height: size,
    borderRadius: r,
    background: look.background,
    color: look.color,
    border: look.border,
    outline: isToday ? `2px solid ${color}` : undefined,
    outlineOffset: isToday ? 2 : undefined,
  } as const

  if (!interactive) {
    return (
      <span role="img" aria-label={label} className={cx('grid shrink-0 place-items-center', className)} style={style}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      className={cx('press no-select grid shrink-0 place-items-center', className)}
      style={style}
      {...handlers}
    >
      {content}
    </button>
  )
}
