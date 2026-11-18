// Offline-first Sync zwischen lokaler DB (Dexie) und Supabase.
//
//  * Schreiben passiert immer zuerst lokal (repo.ts) und markiert die Zeile als _dirty.
//  * Der Sync läuft im Hintergrund: erst PULL (Änderungen anderer Geräte holen), dann PUSH (eigene Änderungen).
//  * Konfliktlösung "last write wins" über updated_at. Auf dem Server verwirft ein Trigger zusätzlich
//    ältere Schreibvorgänge (siehe supabase/schema.sql).
//  * Der Pull-Cursor ist die SERVER-Zeit (synced_at), nicht die Uhr des Geräts.
//  * Löschen = Soft Delete (deleted_at) → wird wie jede andere Änderung synchronisiert.
import type { Table } from 'dexie'
import { db, getMeta, setMeta, SYNC_TABLES, type SyncTable } from './db'
import { supabase } from './supabase'

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncSnapshot {
  status: SyncStatus
  lastSync: string | null
  error: string | null
}

type AnyRow = Record<string, any> & { id: string; updated_at: string }

export interface RemoteApi {
  /** Zeilen mit synced_at >= cursor, sortiert nach (synced_at, id), Bereich [from, to]. */
  pull(table: SyncTable, cursor: string | null, from: number, to: number): Promise<AnyRow[]>
  push(table: SyncTable, rows: AnyRow[]): Promise<void>
}

const PAGE = 1000
const PUSH_CHUNK = 200

// ---------------------------------------------------------------------------
// Kern (testbar, unabhängig von Supabase)
// ---------------------------------------------------------------------------

const TIME_FIELDS = ['updated_at', 'deleted_at', 'created_at']

function normalizeRemote(row: AnyRow): AnyRow {
  const out: AnyRow = { ...row }
  delete out.synced_at
  for (const f of TIME_FIELDS) {
    if (typeof out[f] === 'string') out[f] = new Date(out[f]).toISOString()
  }
  if (out.value !== undefined && out.value !== null) out.value = Number(out.value)
  if (out.target_value !== undefined && out.target_value !== null) out.target_value = Number(out.target_value)
  return out
}

const tableOf = (name: SyncTable) => db[name] as unknown as Table<AnyRow & { _dirty: 0 | 1 }, string>

/** Übernimmt Server-Zeilen lokal. Eine noch nicht hochgeladene, neuere lokale Änderung gewinnt. */
export async function mergeRemoteRows(name: SyncTable, rows: AnyRow[]): Promise<void> {
  if (rows.length === 0) return
  const t = tableOf(name)
  await db.transaction('rw', t, async () => {
    for (const raw of rows) {
      const remote = normalizeRemote(raw)
      const local = await t.get(remote.id)
      if (local && local._dirty === 1 && Date.parse(local.updated_at) >= Date.parse(remote.updated_at)) continue
      if (name === 'completions') {
        // Sicherheitsnetz: pro (habit_id, date) nur eine Zeile
        const dups = await db.completions.where('[habit_id+date]').equals([remote.habit_id, remote.date]).toArray()
        for (const d of dups) if (d.id !== remote.id) await db.completions.delete(d.id)
      }
      await t.put({ ...remote, _dirty: 0 })
    }
  })
}

export async function pullTable(api: RemoteApi, name: SyncTable): Promise<number> {
  const cursorKey = `cursor:${name}`
  const cursor = (await getMeta<string>(cursorKey)) ?? null
  let newest = cursor
  let from = 0
  let total = 0
  for (;;) {
    const page = await api.pull(name, cursor, from, from + PAGE - 1)
    await mergeRemoteRows(name, page)
    for (const r of page) {
      const s = r.synced_at as string | undefined
      if (s && (!newest || s > newest)) newest = s
    }
    total += page.length
    if (page.length < PAGE) break
    from += PAGE
  }
  if (newest && newest !== cursor) await setMeta(cursorKey, newest)
  return total
}

export async function pushTableRows(api: RemoteApi, name: SyncTable): Promise<number> {
  const t = tableOf(name)
  let pushed = 0
  for (;;) {
    const dirty = await t.where('_dirty').equals(1).limit(PUSH_CHUNK).toArray()
    if (dirty.length === 0) break
    const payload = dirty.map(({ _dirty: _ignored, ...row }) => row as AnyRow)
    await api.push(name, payload)
    // Nur als sauber markieren, wenn die Zeile seit dem Hochladen nicht erneut geändert wurde.
    await db.transaction('rw', t, async () => {
      for (const sent of payload) {
        const cur = await t.get(sent.id)
        if (cur && cur._dirty === 1 && cur.updated_at === sent.updated_at) await t.update(sent.id, { _dirty: 0 })
      }
    })
    pushed += dirty.length
    if (dirty.length < PUSH_CHUNK) break
  }
  return pushed
}

/** Ein kompletter Durchlauf: pull → push (Reihenfolge der Tabellen wegen Fremdschlüsseln). */
export async function syncWith(api: RemoteApi): Promise<{ pulled: number; pushed: number }> {
  let pulled = 0
  let pushed = 0
  for (const t of SYNC_TABLES) pulled += await pullTable(api, t)
  for (const t of SYNC_TABLES) pushed += await pushTableRows(api, t)
  return { pulled, pushed }
}

// ---------------------------------------------------------------------------
// Supabase-Anbindung
// ---------------------------------------------------------------------------

const supabaseApi: RemoteApi = {
  async pull(table, cursor, from, to) {
    let q = supabase!.from(table).select('*').order('synced_at', { ascending: true }).order('id', { ascending: true }).range(from, to)
    if (cursor) q = q.gte('synced_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as AnyRow[]
  },
  async push(table, rows) {
    const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Status & Steuerung
// ---------------------------------------------------------------------------

let snapshot: SyncSnapshot = { status: 'local', lastSync: null, error: null }
const listeners = new Set<() => void>()

function setSnapshot(next: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((l) => l())
}

export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function getSyncSnapshot(): SyncSnapshot {
  return snapshot
}

let enabled = false
let running = false
let rerun = false
let timer: ReturnType<typeof setTimeout> | undefined
let interval: ReturnType<typeof setInterval> | undefined

function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
  return (
    e instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  )
}

function errorMessage(e: unknown): string {
  const m = (e as { message?: string; details?: string })?.message
  return m ? String(m) : 'Unbekannter Fehler'
}

export async function syncNow(): Promise<void> {
  if (!enabled || !supabase) return
  if (running) {
    rerun = true
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSnapshot({ status: 'offline' })
    return
  }
  running = true
  setSnapshot({ status: 'syncing', error: null })
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setSnapshot({ status: 'offline' })
      return
    }
    await syncWith(supabaseApi)
    const lastSync = new Date().toISOString()
    await setMeta('lastSync', lastSync)
    setSnapshot({ status: 'synced', lastSync, error: null })
  } catch (e) {
    if (isNetworkError(e)) setSnapshot({ status: 'offline' })
    else {
      console.error('Sync-Fehler', e)
      setSnapshot({ status: 'error', error: errorMessage(e) })
    }
  } finally {
    running = false
    if (rerun) {
      rerun = false
      requestSync(300)
    }
  }
}

/** Sync kurz verzögert anstoßen (bündelt mehrere schnelle Änderungen). */
export function requestSync(delay = 800): void {
  if (!enabled) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

function onOnline() {
  void syncNow()
}
function onOffline() {
  setSnapshot({ status: 'offline' })
}
function onVisible() {
  if (document.visibilityState !== 'visible') return
  const last = snapshot.lastSync ? Date.parse(snapshot.lastSync) : 0
  if (Date.now() - last > 15_000) void syncNow()
}

export async function startSyncEngine(): Promise<void> {
  if (!supabase || enabled) return
  enabled = true
  const last = await getMeta<string>('lastSync')
  setSnapshot({ status: navigator.onLine ? 'idle' : 'offline', lastSync: last ?? null })
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  interval = setInterval(() => void syncNow(), 60_000)
  void syncNow()
}

export function stopSyncEngine(): void {
  enabled = false
  clearTimeout(timer)
  clearInterval(interval)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisible)
  setSnapshot({ status: supabase ? 'idle' : 'local', error: null })
}

export function setLocalOnlyStatus(): void {
  setSnapshot({ status: 'local' })
}
