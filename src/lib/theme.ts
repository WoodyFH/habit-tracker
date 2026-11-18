// Darstellung: automatisch (System), hell oder dunkel – pro Gerät in localStorage.
import { useCallback, useState } from 'react'

export type ThemeChoice = 'auto' | 'light' | 'dark'
const KEY = 'habit-tracker-theme'
const BG = { light: '#f4f5f7', dark: '#0f1115' }

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Setzt data-theme und die Farbe der Statusleiste (theme-color). */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  try {
    if (choice === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* ignorieren */
  }
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  metas.forEach((m) => {
    const media = m.getAttribute('media') ?? ''
    if (choice === 'auto') {
      m.content = media.includes('dark') ? BG.dark : BG.light
    } else m.content = BG[choice]
  })
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(getTheme)
  const set = useCallback((c: ThemeChoice) => {
    applyTheme(c)
    setChoice(c)
  }, [])
  return [choice, set]
}
