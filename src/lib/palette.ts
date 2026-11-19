// Farbpalette (21 Farben) – ohne Abhängigkeiten, damit auch das Scriptable-Widget sie nutzen kann.

export interface HabitColor {
  key: string
  name: string
  hex: string
}

export const COLORS: HabitColor[] = [
  { key: 'red', name: 'Rot', hex: '#ef4444' },
  { key: 'orange', name: 'Orange', hex: '#f97316' },
  { key: 'amber', name: 'Amber', hex: '#f59e0b' },
  { key: 'yellow', name: 'Gelb', hex: '#eab308' },
  { key: 'lime', name: 'Limette', hex: '#84cc16' },
  { key: 'green', name: 'Grün', hex: '#22c55e' },
  { key: 'emerald', name: 'Smaragd', hex: '#10b981' },
  { key: 'teal', name: 'Türkis', hex: '#14b8a6' },
  { key: 'cyan', name: 'Cyan', hex: '#06b6d4' },
  { key: 'sky', name: 'Himmelblau', hex: '#0ea5e9' },
  { key: 'blue', name: 'Blau', hex: '#3b82f6' },
  { key: 'indigo', name: 'Indigo', hex: '#6366f1' },
  { key: 'violet', name: 'Violett', hex: '#8b5cf6' },
  { key: 'purple', name: 'Lila', hex: '#a855f7' },
  { key: 'fuchsia', name: 'Magenta', hex: '#d946ef' },
  { key: 'pink', name: 'Pink', hex: '#ec4899' },
  { key: 'rose', name: 'Rose', hex: '#f43f5e' },
  { key: 'slate', name: 'Schiefer', hex: '#64748b' },
  { key: 'gray', name: 'Grau', hex: '#6b7280' },
  { key: 'stone', name: 'Steingrau', hex: '#78716c' },
  { key: 'zinc', name: 'Zink', hex: '#71717a' },
]

export const DEFAULT_COLOR = 'indigo'

export function colorHex(key: string): string {
  return (COLORS.find((c) => c.key === key) ?? COLORS.find((c) => c.key === DEFAULT_COLOR)!).hex
}

/** Lesbare Textfarbe auf einer Farbfläche (WCAG-Luminanz). */
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.4 ? '#1c1917' : '#ffffff'
}
