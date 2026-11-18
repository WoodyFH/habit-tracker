import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitDB, _replaceDb, db, setCurrentUserId } from './db'
import { pushTableRows, pullTable, syncWith, type RemoteApi } from './sync'

// requestSync() im repo darf im Test nichts anstoßen
vi.mock('./supabase', () => ({ supabase: null, isSupabaseConfigured: false }))

import { completionId, createHabit, setCompletion, toggleDay, updateHabit } from './repo'

type Row = Record<string, any> & { id: string; updated_at: string }

/** Minimaler Fake des Servers inkl. "last write wins"-Trigger und synced_at (Server-Uhr). */
class FakeServer implements RemoteApi {
  tables: Record<string, Map<string, Row>> = {}
  clock = 1
  failNext = false

  private t(name: string) {
    return (this.tables[name] ??= new Map())
  }
  private stamp() {
    return `2026-03-01T00:00:${String(this.clock++).padStart(2, '0')}.000000+00:00`
  }
  async pull(table: string, cursor: string | null, from: number, to: number) {
    const rows = [...this.t(table).values()]
      .filter((r) => !cursor || r.synced_at >= cursor)
      .sort((a, b) => (a.synced_at < b.synced_at ? -1 : a.synced_at > b.synced_at ? 1 : a.id < b.id ? -1 : 1))
    return rows.slice(from, to + 1).map((r) => ({ ...r }))
  }
  async push(table: string, rows: Row[]) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('boom')
    }
    for (const r of rows) {
      const old = this.t(table).get(r.id)
      if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue // Trigger verwirft ältere Updates
      this.t(table).set(r.id, { ...r, synced_at: this.stamp() })
    }
  }
}

const habitInput = {
  name: 'Test',
  description: null,
  icon: 'check',
  color: 'indigo',
  type: 'build' as const,
  tracking_mode: 'yes_no' as const,
  target_value: null,
  unit: null,
  schedule_type: 'daily' as const,
  schedule_config: {},
  start_date: '2026-03-01',
  end_date: null,
}

let n = 0
beforeEach(() => {
  _replaceDb(new HabitDB(`test-${++n}`))
  setCurrentUserId('00000000-0000-4000-8000-000000000001')
})

describe('lokale Schreibzugriffe', () => {
  it('Einträge haben eine deterministische ID → pro Tag genau eine Zeile', async () => {
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 1)
    await setCompletion(id, '2026-03-02', 0) // löschen
    await setCompletion(id, '2026-03-02', 1) // wieder anlegen
    const rows = await db.completions.where('habit_id').equals(id).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(completionId(id, '2026-03-02'))
    expect(rows[0].deleted_at).toBeNull()
    expect(rows[0]._dirty).toBe(1)
  })

  it('Löschen ist ein Soft Delete', async () => {
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 1)
    await toggleDay({ id, type: 'build', tracking_mode: 'yes_no', target_value: null }, '2026-03-02', 1)
    const row = await db.completions.get(completionId(id, '2026-03-02'))
    expect(row?.deleted_at).toBeTruthy()
  })

  it('Rückwirkend eintragen zieht das Startdatum vor', async () => {
    const id = await createHabit({ ...habitInput, start_date: '2026-03-10' })
    await setCompletion(id, '2026-03-05', 1)
    expect((await db.habits.get(id))!.start_date).toBe('2026-03-05')
    expect((await db.habits.get(id))!._dirty).toBe(1)
    // spätere Tage ändern den Start nicht, Löschen auch nicht
    await setCompletion(id, '2026-03-12', 1)
    await setCompletion(id, '2026-03-05', 0)
    expect((await db.habits.get(id))!.start_date).toBe('2026-03-05')
  })

  it('Notiz ohne Wert behält die Zeile', async () => {
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 0, 'nur eine Notiz')
    const row = await db.completions.get(completionId(id, '2026-03-02'))
    expect(row?.deleted_at).toBeNull()
    expect(row?.note).toBe('nur eine Notiz')
  })
})

describe('Sync', () => {
  it('Push lädt lokale Änderungen hoch und markiert sie als sauber', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 1)
    const res = await syncWith(server)
    expect(res.pushed).toBe(2)
    expect(server.tables.habits.size).toBe(1)
    expect(server.tables.completions.size).toBe(1)
    expect(await db.habits.where('_dirty').equals(1).count()).toBe(0)
    expect(await db.completions.where('_dirty').equals(1).count()).toBe(0)
  })

  it('Pull holt Änderungen anderer Geräte', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 1)
    await syncWith(server)

    // "Gerät B" schreibt direkt auf den Server
    await server.push('completions', [
      { id: 'b1', habit_id: id, user_id: 'u', date: '2026-03-03', value: 1, note: null, updated_at: new Date().toISOString(), deleted_at: null },
    ])
    await syncWith(server)
    expect(await db.completions.get('b1')).toMatchObject({ date: '2026-03-03', _dirty: 0 })
  })

  it('Last write wins: neuere Server-Version überschreibt ältere lokale Änderung', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await syncWith(server)

    await updateHabit(id, { name: 'lokal' })
    const local = await db.habits.get(id)
    const newer = new Date(Date.parse(local!.updated_at) + 5000).toISOString()
    // Server hat eine neuere Version von einem anderen Gerät
    server.tables.habits.set(id, { ...local!, name: 'remote', updated_at: newer, synced_at: '2026-03-01T00:01:00.000000+00:00' } as Row)
    await syncWith(server)

    expect((await db.habits.get(id))!.name).toBe('remote')
    expect(server.tables.habits.get(id)!.name).toBe('remote')
  })

  it('Last write wins: neuere lokale Änderung gewinnt und wird hochgeladen', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await syncWith(server)

    const remoteRow = { ...(server.tables.habits.get(id) as Row), name: 'alt-remote', updated_at: new Date(Date.now() - 60_000).toISOString(), synced_at: '2026-03-01T00:02:00.000000+00:00' }
    server.tables.habits.set(id, remoteRow)
    await updateHabit(id, { name: 'neu-lokal' })
    await syncWith(server)

    expect((await db.habits.get(id))!.name).toBe('neu-lokal')
    expect(server.tables.habits.get(id)!.name).toBe('neu-lokal')
  })

  it('Soft Delete wird synchronisiert (Tombstone)', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await setCompletion(id, '2026-03-02', 1)
    await syncWith(server)
    await setCompletion(id, '2026-03-02', 0)
    await syncWith(server)
    expect(server.tables.completions.get(completionId(id, '2026-03-02'))!.deleted_at).toBeTruthy()
  })

  it('Zwei Geräte legen offline denselben Tag an → eine Zeile (deterministische ID)', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await syncWith(server)
    await setCompletion(id, '2026-03-02', 1)
    // Gerät B erzeugt dieselbe ID
    await server.push('completions', [
      { id: completionId(id, '2026-03-02'), habit_id: id, user_id: 'u', date: '2026-03-02', value: 1, note: 'B', updated_at: new Date(Date.now() - 1000).toISOString(), deleted_at: null },
    ])
    await syncWith(server)
    expect(await db.completions.where('habit_id').equals(id).count()).toBe(1)
    expect(server.tables.completions.size).toBe(1)
  })

  it('Fehler beim Push lässt die Zeilen als dirty zurück (kein Datenverlust)', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    server.failNext = true
    await expect(pushTableRows(server, 'habits')).rejects.toThrow('boom')
    expect(await db.habits.where('_dirty').equals(1).count()).toBe(1)
    await pushTableRows(server, 'habits')
    expect(await db.habits.where('_dirty').equals(1).count()).toBe(0)
    expect(server.tables.habits.has(id)).toBe(true)
  })

  it('Pull-Cursor wandert mit der Server-Zeit; erneuter Pull ist idempotent', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    await syncWith(server)
    const first = await pullTable(server, 'habits')
    const second = await pullTable(server, 'habits')
    expect(first).toBeGreaterThanOrEqual(1)
    expect(second).toBe(first)
    expect(await db.habits.count()).toBe(1)
    expect(await db.habits.get(id)).toBeTruthy()
  })

  it('Offline-Änderungen während eines laufenden Pushs gehen nicht verloren', async () => {
    const server = new FakeServer()
    const id = await createHabit(habitInput)
    const origPush = server.push.bind(server)
    server.push = async (table, rows) => {
      await origPush(table, rows)
      if (table === 'habits') await updateHabit(id, { name: 'während push geändert' })
    }
    await pushTableRows(server, 'habits')
    const h = await db.habits.get(id)
    expect(h!._dirty).toBe(1) // bleibt dirty → wird beim nächsten Sync hochgeladen
  })
})
