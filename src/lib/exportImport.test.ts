import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitDB, _replaceDb, db, setCurrentUserId } from './db'

vi.mock('./supabase', () => ({ supabase: null, isSupabaseConfigured: false }))

import { backupToCsv, buildBackup, importBackup, parseBackup } from './exportImport'
import { createCategory, createHabit, deleteHabit, setCompletion } from './repo'

const input = {
  name: 'Wasser; "trinken"',
  description: null,
  icon: 'droplets',
  color: 'sky',
  type: 'build' as const,
  tracking_mode: 'counter' as const,
  target_value: 8,
  unit: 'Gläser',
  schedule_type: 'times_per_week' as const,
  schedule_config: { times: 5 },
  start_date: '2026-03-01',
  end_date: null,
}

let n = 0
beforeEach(() => {
  _replaceDb(new HabitDB(`export-${++n}`))
  setCurrentUserId('00000000-0000-4000-8000-000000000001')
})

describe('Export / Import', () => {
  it('Export enthält keine user_id, keine gelöschten Zeilen und keine Dirty-Flags', async () => {
    const cat = await createCategory('Gesundheit')
    const id = await createHabit(input, [cat])
    const gone = await createHabit({ ...input, name: 'weg' })
    await deleteHabit(gone)
    await setCompletion(id, '2026-03-02', 8, 'gut')
    await setCompletion(id, '2026-03-03', 3)
    await setCompletion(id, '2026-03-03', 0) // gelöscht

    const b = await buildBackup()
    expect(b.habits).toHaveLength(1)
    expect(b.completions).toHaveLength(1)
    expect(JSON.stringify(b)).not.toContain('user_id')
    expect(JSON.stringify(b)).not.toContain('_dirty')
    expect(b.habit_categories).toHaveLength(1)
  })

  it('JSON-Round-Trip stellt Daten in einer leeren DB wieder her', async () => {
    const cat = await createCategory('Gesundheit')
    const id = await createHabit(input, [cat])
    await setCompletion(id, '2026-03-02', 8, 'gut')
    const json = JSON.stringify(await buildBackup())

    _replaceDb(new HabitDB(`export-restore-${n}`))
    const res = await importBackup(json)
    expect(res).toMatchObject({ habits: 1, categories: 1, completions: 1, skipped: 0 })
    expect(await db.habits.count()).toBe(1)
    const c = (await db.completions.toArray())[0]
    expect(c).toMatchObject({ date: '2026-03-02', value: 8, note: 'gut', _dirty: 1, user_id: '00000000-0000-4000-8000-000000000001' })
  })

  it('Import ist idempotent (gleiche IDs → keine Duplikate)', async () => {
    const id = await createHabit(input)
    await setCompletion(id, '2026-03-02', 8)
    const json = JSON.stringify(await buildBackup())
    await importBackup(json)
    await importBackup(json)
    expect(await db.habits.count()).toBe(1)
    expect(await db.completions.count()).toBe(1)
  })

  it('ungültige Dateien und Zeilen werden abgefangen', async () => {
    expect(() => parseBackup('kein json')).toThrow('gültiges JSON')
    expect(() => parseBackup('{"app":"x"}')).toThrow('keine Habit-Tracker-Sicherung')
    expect(() => parseBackup('{"app":"habit-tracker","version":99}')).toThrow('neueren')
    const { backup, skipped } = parseBackup(
      JSON.stringify({
        app: 'habit-tracker',
        version: 1,
        habits: [{ id: 'h1', name: 'ok', start_date: '2026-03-01', schedule_type: 'daily', tracking_mode: 'yes_no' }, { id: 'h2', name: 'kaputt', start_date: 'gestern' }],
        completions: [
          { habit_id: 'h1', date: '2026-02-30', value: 1 },
          { habit_id: 'h1', date: '2026-03-02', value: 1 },
          { habit_id: 'unbekannt', date: '2026-03-02', value: 1 },
        ],
      }),
    )
    expect(backup.habits).toHaveLength(1)
    expect(backup.completions).toHaveLength(1)
    expect(skipped).toBe(3)
  })

  it('CSV: Semikolon, Anführungszeichen maskiert, BOM, eine Zeile pro Eintrag', async () => {
    const id = await createHabit(input)
    await createHabit({ ...input, name: 'leer' })
    await setCompletion(id, '2026-03-02', 8, 'Zeile\nzwei')
    const csv = backupToCsv(await buildBackup())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.split('\r\n') // (trim() würde das BOM entfernen)
    expect(lines[0].startsWith('﻿Gewohnheit;Art')).toBe(true)
    expect(csv).toContain('"Wasser; ""trinken"""')
    expect(csv).toContain('5× pro Woche')
    expect(csv).toContain('"Zeile\nzwei"')
    expect(csv).toContain('leer;Aufbauen')
  })
})
