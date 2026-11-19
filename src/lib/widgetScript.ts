// Erzeugt das fertige Scriptable-Skript: Vorlage (aus widget/src, siehe scripts/build-widget.mjs) + deine öffentlichen Werte.
import template from '../generated/habit-widget.js?raw'

export interface WidgetConfig {
  supabaseUrl: string
  anonKey: string
  appUrl: string
}

const PLACEHOLDERS: Array<[keyof WidgetConfig, string]> = [
  ['supabaseUrl', '__HT_SUPABASE_URL__'],
  ['anonKey', '__HT_ANON_KEY__'],
  ['appUrl', '__HT_APP_URL__'],
]

/** Ersetzt die Platzhalter. Die Werte landen in Anführungszeichen im Skript und dürfen keine Sonderzeichen enthalten. */
export function fillWidgetTemplate(tpl: string, cfg: WidgetConfig): string {
  let out = tpl
  for (const [key, token] of PLACEHOLDERS) {
    const value = cfg[key]
    if (!value || /["'\\\s`$]/.test(value)) throw new Error(`Ungültiger Wert für ${key}`)
    if (!out.includes(token)) throw new Error(`Platzhalter ${token} fehlt in der Vorlage`)
    out = out.split(token).join(value)
  }
  return out
}

export function buildWidgetScript(cfg: WidgetConfig): string {
  return fillWidgetTemplate(template, cfg)
}
