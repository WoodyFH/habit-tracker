// Lokale Datenbank (IndexedDB über Dexie). Alle Änderungen landen zuerst hier – Offline-first.
import Dexie, { type Table } from 'dexie'
import type { Category, Completion, Habit, HabitCategory, Local, Pause } from './types'

export interface MetaRow {
  key: string
  value: unknown
}

export const SYNC_TABLES = ['habits', 'categories', 'habit_categories', 'completions', 'pauses'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export class HabitDB extends Dexie {
  habits!: Table<Local<Habit>, string>
  categories!: Table<Local<Category>, string>
  habit_categories!: Table<Local<HabitCategory>, string>
  completions!: Table<Local<Completion>, string>
  pauses!: Table<Local<Pause>, string>
  meta!: Table<MetaRow, string>

  constructor(name = 'habit-tracker') {
    super(name)
    this.version(1).stores({
      habits: 'id, sort_order, _dirty',
      categories: 'id, _dirty',
      habit_categories: 'id, habit_id, category_id, [habit_id+category_id], _dirty',
      completions: 'id, habit_id, date, [habit_id+date], _dirty',
      pauses: 'id, habit_id, _dirty',
      meta: 'key',
    })
  }
}

export let db = new HabitDB()

/** Nur für Tests: eine frische DB einsetzen. */
export function _replaceDb(next: HabitDB) {
  db = next
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

/** Löscht alle lokalen Daten (z. B. beim Abmelden). */
export async function wipeLocalData(): Promise<void> {
  await db.transaction('rw', [db.habits, db.categories, db.habit_categories, db.completions, db.pauses, db.meta], async () => {
    await Promise.all([
      db.habits.clear(),
      db.categories.clear(),
      db.habit_categories.clear(),
      db.completions.clear(),
      db.pauses.clear(),
      db.meta.clear(),
    ])
  })
}

export async function countDirty(): Promise<number> {
  const counts = await Promise.all(SYNC_TABLES.map((t) => (db[t] as Table<{ _dirty: 0 | 1 }, string>).where('_dirty').equals(1).count()))
  return counts.reduce((a, b) => a + b, 0)
}

// ---- Aktueller Nutzer (für user_id neuer Zeilen) ----

let currentUserId = 'local'
export function setCurrentUserId(id: string) {
  currentUserId = id
}
export function getCurrentUserId(): string {
  return currentUserId
}
