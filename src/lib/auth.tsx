// Anmeldung (Supabase Auth, E-Mail + Passwort). Registrierung ist im Supabase-Projekt deaktiviert.
// Offline-Start: Ist ein Nutzer von früher bekannt und es gibt kein Netz, startet die App mit den lokalen Daten.
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { countDirty, db, getMeta, setCurrentUserId, setMeta, SYNC_TABLES, wipeLocalData } from './db'
import { supabase } from './supabase'
import { setLocalOnlyStatus, startSyncEngine, stopSyncEngine, syncNow } from './sync'
import type { Table } from 'dexie'

export type AuthStatus = 'loading' | 'out' | 'in' | 'local'

interface AuthValue {
  status: AuthStatus
  userId: string | null
  email: string | null
  /** Gibt eine deutsche Fehlermeldung zurück oder null bei Erfolg. */
  signIn(email: string, password: string): Promise<string | null>
  /** Gibt true zurück, wenn abgemeldet wurde. */
  signOut(confirmLoss: () => Promise<boolean>): Promise<boolean>
}

const Ctx = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider fehlt')
  return v
}

/** Lokale Zeilen einem (neuen) Nutzer zuordnen – z. B. Daten, die im Nur-lokal-Modus entstanden sind. */
async function adoptRows(userId: string) {
  for (const name of SYNC_TABLES) {
    const t = db[name] as unknown as Table<{ user_id: string; _dirty: 0 | 1 }, string>
    await t.toCollection().modify((r) => {
      if (r.user_id !== userId) {
        r.user_id = userId
        r._dirty = 1
      }
    })
  }
}

function germanAuthError(message: string, offline: boolean): string {
  if (offline) return 'Keine Internetverbindung. Zum ersten Anmelden wird eine Verbindung benötigt.'
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.'
  if (m.includes('email not confirmed')) return 'Die E-Mail-Adresse ist noch nicht bestätigt (siehe Supabase → Authentication → Users).'
  if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Der Server ist nicht erreichbar. Bitte Verbindung prüfen.'
  return `Anmeldung fehlgeschlagen: ${message}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: AuthStatus; userId: string | null; email: string | null }>({
    status: 'loading',
    userId: null,
    email: null,
  })
  const activating = useRef(false)

  const activate = useCallback(async (userId: string, email: string | null) => {
    activating.current = true
    try {
      const saved = await getMeta<string>('userId')
      // Anderer Nutzer auf diesem Gerät → lokale Daten des alten Nutzers entfernen.
      if (saved && saved !== 'local' && saved !== userId) await wipeLocalData()
      if (userId !== 'local') await adoptRows(userId)
      await setMeta('userId', userId)
      await setMeta('email', email)
      setCurrentUserId(userId)
      setState({ status: userId === 'local' ? 'local' : 'in', userId, email })
      if (userId === 'local' || !supabase) setLocalOnlyStatus()
      else void startSyncEngine()
    } finally {
      activating.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!supabase) {
        // Nur-lokal-Modus (Supabase nicht konfiguriert)
        const saved = await getMeta<string>('userId')
        if (!cancelled) await activate(saved && saved !== 'local' ? saved : 'local', (await getMeta<string>('email')) ?? null)
        return
      }
      const { data, error } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        await activate(data.session.user.id, data.session.user.email ?? null)
        return
      }
      const saved = await getMeta<string>('userId')
      const networkProblem = !navigator.onLine || (error ? isAuthRetryableFetchError(error) : false)
      if (saved && saved !== 'local' && networkProblem) {
        // Offline-Start ohne gültiges Token: lokale Daten anzeigen, Sync läuft später weiter.
        await activate(saved, (await getMeta<string>('email')) ?? null)
      } else {
        setState({ status: 'out', userId: null, email: null })
      }
    })()

    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !activating.current) {
        stopSyncEngine()
        setState({ status: 'out', userId: null, email: null })
      }
    })
    return () => {
      cancelled = true
      sub?.data.subscription.unsubscribe()
    }
  }, [activate])

  const signIn = useCallback<AuthValue['signIn']>(
    async (email, password) => {
      if (!supabase) return 'Supabase ist nicht konfiguriert.'
      if (!navigator.onLine) return germanAuthError('', true)
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error || !data.session) return germanAuthError(error?.message ?? 'Unbekannter Fehler', false)
      await activate(data.session.user.id, data.session.user.email ?? null)
      return null
    },
    [activate],
  )

  const signOut = useCallback<AuthValue['signOut']>(async (confirmLoss) => {
    if (supabase && navigator.onLine) await syncNow()
    if ((await countDirty()) > 0 && !(await confirmLoss())) return false
    stopSyncEngine()
    await supabase?.auth.signOut()
    await wipeLocalData()
    setCurrentUserId('local')
    setState({ status: 'out', userId: null, email: null })
    return true
  }, [])

  const value = useMemo<AuthValue>(() => ({ ...state, signIn, signOut }), [state, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
