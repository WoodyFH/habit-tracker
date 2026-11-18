// Kleine UI-Bausteine im einheitlichen Look (große Tap-Flächen, runde Formen).
import { Minus, Plus } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'soft' | 'ghost' | 'danger'
  /** Hintergrundfarbe (Hex) für "solid", Textfarbe wird automatisch gewählt. */
  color?: string
  textColor?: string
  size?: 'md' | 'lg' | 'sm'
}

export function Button({ variant = 'soft', color, textColor, size = 'md', className, style, children, ...rest }: BtnProps) {
  const sizes = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-[15px]' }
  const base = 'press inline-flex items-center justify-center gap-2 rounded-2xl font-semibold disabled:opacity-40 disabled:pointer-events-none select-none'
  const look =
    variant === 'solid'
      ? 'shadow-sm'
      : variant === 'danger'
        ? 'bg-[#ef4444] text-white'
        : variant === 'ghost'
          ? 'text-muted bg-transparent'
          : 'bg-soft text-ink'
  return (
    <button
      type="button"
      className={cx(base, sizes[size], look, className)}
      style={variant === 'solid' ? { background: color ?? '#6366f1', color: textColor ?? '#fff', ...style } : style}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('press grid size-10 place-items-center rounded-full bg-card text-ink shadow-card disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Chip({
  active,
  color,
  textColor,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; color?: string; textColor?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold select-none',
        active ? 'shadow-sm' : 'bg-card text-ink shadow-card',
      )}
      style={active ? { background: color ?? '#6366f1', color: textColor ?? '#fff' } : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  color,
  textColor,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: ReactNode }>
  color?: string
  textColor?: string
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-soft p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'press flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-[13.5px] font-semibold',
              active ? 'shadow-sm' : 'text-muted',
            )}
            style={active ? { background: color ?? 'var(--seg)', color: color ? (textColor ?? '#fff') : 'var(--ink)' } : undefined}
          >
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-14 shrink-0 rounded-full transition-colors', checked ? 'bg-[#22c55e]' : 'bg-soft')}
    >
      <span
        className={cx('absolute top-1 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-7' : 'left-1')}
      />
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
  color,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Weniger"
        className="press grid size-10 place-items-center rounded-xl bg-soft-raw disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus size={18} />
      </button>
      <div className="min-w-16 text-center text-lg font-bold tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-muted">{suffix}</span>}
      </div>
      <button
        type="button"
        aria-label="Mehr"
        className="press grid size-10 place-items-center rounded-xl text-white disabled:opacity-40"
        style={{ background: color ?? '#6366f1' }}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus size={18} />
      </button>
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-11 w-full min-w-0 rounded-2xl bg-soft px-4 text-ink placeholder:text-muted/70 outline-none focus:ring-2 focus:ring-[var(--ring,#6366f1)]',
        className,
      )}
      {...rest}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="pl-1 text-[12px] font-semibold tracking-wider text-muted uppercase">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl bg-card shadow-card', className)}>{children}</div>
}
