// Prüft und bereinigt die Supabase-Konfiguration aus den Umgebungsvariablen (reine Funktionen).

/**
 * Reduziert die Projekt-URL auf "https://<projekt>.supabase.co".
 * Entfernt Schrägstriche am Ende und Pfade wie "/rest/v1" oder "/auth/v1", die beim Kopieren leicht mitkommen
 * und bei Supabase zu "Invalid path specified in request URL" führen.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/^["']|["']$/g, '')
  if (!value) return null
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.origin
  } catch {
    return null
  }
}

/** Erkennt einen service_role-Key (JWT mit role "service_role") oder einen "sb_secret_…"-Key. */
export function isSecretKey(key: string | undefined): boolean {
  const k = key?.trim() ?? ''
  if (k.startsWith('sb_secret_')) return true
  const parts = k.split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    return json?.role === 'service_role'
  } catch {
    return false
  }
}

export function cleanKey(raw: string | undefined): string | null {
  const v = raw?.trim().replace(/^["']|["']$/g, '')
  return v ? v : null
}
