import { colorHex, iconComponent, onColor, tint } from '../lib/catalog'

/**
 * Abgerundetes Feld mit Icon. Standard: Vollfarbe mit weißem Icon.
 * soft: heller Ton der Farbe mit farbigem Icon (ruhiger, für Karten und Listen).
 */
export function HabitIcon({
  icon,
  color,
  size = 44,
  soft = false,
  className,
}: {
  icon: string
  color: string
  size?: number
  soft?: boolean
  className?: string
}) {
  const hex = colorHex(color)
  const Icon = iconComponent(icon)
  return (
    <span
      className={`grid shrink-0 place-items-center ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: soft ? tint(hex, 18) : hex,
        color: soft ? hex : onColor(hex),
      }}
      aria-hidden="true"
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  )
}
