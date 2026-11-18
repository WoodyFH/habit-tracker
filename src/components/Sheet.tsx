// Bottom Sheet: schiebt von unten herein, per Wischen nach unten am Kopf schließbar.
// Bleibt immer mittig: kein seitliches Verschieben (touch-action: pan-y, overflow-x hidden).
import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Höhe: "auto" passt sich dem Inhalt an, "tall" füllt bis 92 % */
  size?: 'auto' | 'tall'
}

let openSheets = 0

export function Sheet({ open, onClose, title, children, footer, size = 'auto' }: SheetProps) {
  const [dy, setDy] = useState(0)
  const drag = useRef<{ startY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    openSheets++
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      openSheets--
      if (openSheets === 0) document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const onDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setDy(Math.max(0, e.clientY - drag.current.startY))
  }
  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    if (dy > 110) onClose()
    setDy(0)
  }

  return createPortal(
    <div className="sheet-scope fixed inset-0 z-50 flex items-end justify-center overflow-hidden" role="presentation" style={{ touchAction: 'pan-y' }}>
      <div className="anim-fade absolute inset-0" style={{ background: 'var(--overlay)' }} onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet pb-safe relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-bg text-ink shadow-float outline-none"
        style={{
          maxHeight: '92dvh',
          height: size === 'tall' ? '92dvh' : undefined,
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: drag.current ? 'none' : 'transform 0.2s ease',
        }}
      >
        <div className="relative touch-none px-4 pt-2.5 pb-1" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
          <div className="relative mt-2 flex h-11 items-center justify-center">
            <button
              type="button"
              aria-label="Schließen"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="press absolute left-0 grid size-10 place-items-center rounded-full bg-card text-ink shadow-card"
            >
              <X size={18} />
            </button>
            <h2 className="max-w-[70%] truncate text-[17px] font-bold tracking-tight">{title}</h2>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-2 pb-5" style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
        {footer && <div className="px-4 pt-2 pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
