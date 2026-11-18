import { colorHex, iconComponent, onColor } from '../lib/catalog'

/** Abgerundetes Farbfeld mit Icon (Farbe der Gewohnheit). */
export function HabitIcon({ icon, color, size = 44, className }: { icon: string; color: string; size?: number; className?: string }) {
  const hex = colorHex(color)
  const Icon = iconComponent(icon)
  return (
    <span
      className={`grid shrink-0 place-items-center ${className ?? ''}`}
      style={{ width: size, height: size, borderRadius: size * 0.34, background: hex, color: onColor(hex) }}
      aria-hidden="true"
    >
      <Icon size={size * 0.52} strokeWidth={2.3} />
    </span>
  )
}
