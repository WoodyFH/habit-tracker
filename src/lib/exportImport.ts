// Export (JSON / CSV) und Import (JSON-Backup).
import { db, getCurrentUserId } from './db'
import { isDateStr } from './dates'
import { uuid, deterministicId } from './ids'
import { describeSchedule } from './schedule'
import { requestSync } from './sync'
import type { Category, Completion, Habit, HabitCategory, Local, Pause } from './types'

export const BACKUP_VERSION = 1

type Plain<T> = Omit<T, 'user_id'>

export interface BackupFile {
  app: 'habit-tracker'
  version: number
  exported_at: string
  habits: Plain<Habit>[]
  categories: Plain<Category>[]
  habit_categories: Plain<HabitCategory>[]
  completions: Plain<Completion>[]
  pauses: Plain<Pause>[]
}

function clean<T extends { user_id: string }>(row: Local<T>): Plain<T> {
  const { _dirty: _d, user_id: _u, ...rest } = row as Local<T> & { _dirty?: unknown }
  return rest as unknown as Plain<T>
}

/** Alle (nicht gelöschten) Daten als Backup-Objekt. */
export async function buildBackup(): Promise<BackupFile> {
  const [habits, categories, links, completions, pauses] = await Promise.all([
    db.habits.toArray(),
    db.categories.toArray(),
    db.habit_categories.toArray(),
    db.completions.toArray(),
    db.pauses.toArray(),
  ])
  const liveHabits = habits.filter((h) => !h.deleted_at)
  const liveHabitIds = new Set(liveHabits.map((h) => h.id))
  const liveCats = categories.filter((c) => !c.deleted_at)
  const liveCatIds = new Set(liveCats.map((c) => c.id))
  return {
    app: 'habit-tracker',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    habits: liveHabits.map(clean),
    categories: liveCats.map(clean),
    habit_categories: links.filter((l) => !l.deleted_at && liveHabitIds.has(l.habit_id) && liveCatIds.has(l.category_id)).map(clean),
    completions: completions.filter((c) => !c.deleted_at && liveHabitIds.has(c.habit_id)).map(clean),
    pauses: pauses.filter((p) => !p.deleted_at && liveHabitIds.has(p.habit_id)).map(clean),
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV mit Semikolon (deutsches Excel), UTF-8 mit BOM. Eine Zeile pro Eintrag; Gewohnheiten ohne Einträge haben eine Zeile ohne Datum. */
export function backupToCsv(b: BackupFile): string {
  const catName = new Map(b.categories.map((c) => [c.id, c.name]))
  const catsByHabit = new Map<string, string[]>()
  for (const l of b.habit_categories) {
    const n = catName.get(l.category_id)
    if (n) catsByHabit.set(l.habit_id, [...(catsByHabit.get(l.habit_id) ?? []), n])
  }
  const compsByHabit = new Map<string, Plain<Completion>[]>()
  for (const c of b.completions) compsByHabit.set(c.habit_id, [...(compsByHabit.get(c.habit_id) ?? []), c])

  const header = ['Gewohnheit', 'Art', 'Wiederholung', 'Erfassung', 'Ziel', 'Einheit', 'Kategorien', 'Start', 'Ende', 'Archiviert', 'Datum', 'Wert', 'Notiz']
  const lines = [header.join(';')]
  for (const h of b.habits) {
    const base = [
      h.name,
      h.type === 'quit' ? 'Abgewöhnen' : 'Aufbauen',
      describeSchedule(h),
      h.tracking_mode === 'counter' ? 'Zähler' : h.tracking_mode === 'measurement' ? 'Messwert' : 'Ja/Nein',
      h.target_value ?? '',
      h.unit ?? '',
      (catsByHabit.get(h.id) ?? []).join(', '),
      h.start_date,
      h.end_date ?? '',
      h.archived ? 'ja' : 'nein',
    ]
    const comps = (compsByHabit.get(h.id) ?? []).sort((a, c) => a.date.localeCompare(c.date))
    if (comps.length === 0) lines.push([...base, '', '', ''].map(csvCell).join(';'))
    for (const c of comps) lines.push([...base, c.date, c.value, c.note ?? ''].map(csvCell).join(';'))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportResult {
  habits: number
  categories: number
  completions: number
  pauses: number
  skipped: number
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

/** Prüft und normalisiert eine Backup-Datei. Ungültige Zeilen werden übersprungen (und gezählt). */
export function parseBackup(text: string): { backup: BackupFile; skipped: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  if (!isObj(raw) || raw.app !== 'habit-tracker') throw new Error('Das ist keine Habit-Tracker-Sicherung.')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) throw new Error('Die Sicherung stammt aus einer neueren App-Version.')

  let skipped = 0
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : [])
  const now = new Date().toISOString()
  const scheduleTypes = ['daily', 'weekdays', 'times_per_week', 'times_per_month', 'every_n_days']
  const modes = ['yes_no', 'counter', 'measurement']

  const habits: BackupFile['habits'] = []
  for (const h of list(raw.habits)) {
    const id = str(h.id)
    const name = str(h.name)
    if (!id || !name || !isDateStr(h.start_date) || !scheduleTypes.includes(h.schedule_type as string) || !modes.includes(h.tracking_mode as string)) {
      skipped++
      continue
    }
    habits.push({
      id,
      name: name.slice(0, 200),
      description: str(h.description),
      icon: str(h.icon) ?? 'check',
      color: str(h.color) ?? 'indigo',
      type: h.type === 'quit' ? 'quit' : 'build',
      tracking_mode: h.tracking_mode as Habit['tracking_mode'],
      target_value: typeof h.target_value === 'number' ? h.target_value : null,
      unit: str(h.unit),
      schedule_type: h.schedule_type as Habit['schedule_type'],
      schedule_config: isObj(h.schedule_config) ? (h.schedule_config as Habit['schedule_config']) : {},
      start_date: h.start_date as string,
      end_date: isDateStr(h.end_date) ? (h.end_date as string) : null,
      sort_order: typeof h.sort_order === 'number' ? h.sort_order : 0,
      archived: h.archived === true,
      created_at: str(h.created_at) ?? now,
      updated_at: now,
      deleted_at: null,
    })
  }
  const habitIds = new Set(habits.map((h) => h.id))

  const categories: BackupFile['categories'] = []
  for (const c of list(raw.categories)) {
    const id = str(c.id)
    const name = str(c.name)
    if (!id || !name) {
      skipped++
      continue
    }
    categories.push({
      id,
      name: name.slice(0, 100),
      sort_order: typeof c.sort_order === 'number' ? c.sort_order : 0,
      created_at: str(c.created_at) ?? now,
      updated_at: now,
      deleted_at: null,
    })
  }
  const catIds = new Set(categories.map((c) => c.id))

  const habit_categories: BackupFile['habit_categories'] = []
  for (const l of list(raw.habit_categories)) {
    const habit_id = str(l.habit_id)
    const category_id = str(l.category_id)
    if (!habit_id || !category_id || !habitIds.has(habit_id) || !catIds.has(category_id)) {
      skipped++
      continue
    }
    habit_categories.push({ id: deterministicId('habit_category', habit_id, category_id), habit_id, category_id, updated_at: now, deleted_at: null })
  }

  const completions: BackupFile['completions'] = []
  for (const c of list(raw.completions)) {
    const habit_id = str(c.habit_id)
    if (!habit_id || !habitIds.has(habit_id) || !isDateStr(c.date) || typeof c.value !== 'number' || !Number.isFinite(c.value)) {
      skipped++
      continue
    }
    completions.push({
      id: deterministicId('completion', habit_id, c.date as string),
      habit_id,
      date: c.date as string,
      value: c.value,
      note: str(c.note),
      updated_at: now,
      deleted_at: null,
    })
  }

  const pauses: BackupFile['pauses'] = []
  for (const p of list(raw.pauses)) {
    const habit_id = str(p.habit_id)
    if (!habit_id || !habitIds.has(habit_id) || !isDateStr(p.from_date) || !isDateStr(p.to_date) || (p.to_date as string) < (p.from_date as string)) {
      skipped++
      continue
    }
    pauses.push({ id: str(p.id) ?? uuid(), habit_id, from_date: p.from_date as string, to_date: p.to_date as string, updated_at: now, deleted_at: null })
  }

  return {
    backup: { app: 'habit-tracker', version: BACKUP_VERSION, exported_at: str(raw.exported_at) ?? now, habits, categories, habit_categories, completions, pauses },
    skipped,
  }
}

/**
 * Spielt ein Backup ein. Vorhandene Daten bleiben bestehen; gleiche IDs werden überschrieben
 * (die importierte Version gewinnt, da updated_at = jetzt). Es wird nichts gelöscht.
 */
export async function importBackup(text: string): Promise<ImportResult> {
  const { backup, skipped } = parseBackup(text)
  const user_id = getCurrentUserId()
  const tag = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, user_id, _dirty: 1 as const }))
  await db.transaction('rw', [db.habits, db.categories, db.habit_categories, db.completions, db.pauses], async () => {
    await db.habits.bulkPut(tag(backup.habits) as Local<Habit>[])
    await db.categories.bulkPut(tag(backup.categories) as Local<Category>[])
    await db.habit_categories.bulkPut(tag(backup.habit_categories) as Local<HabitCategory>[])
    await db.completions.bulkPut(tag(backup.completions) as Local<Completion>[])
    await db.pauses.bulkPut(tag(backup.pauses) as Local<Pause>[])
  })
  requestSync()
  return {
    habits: backup.habits.length,
    categories: backup.categories.length,
    completions: backup.completions.length,
    pauses: backup.pauses.length,
    skipped,
  }
}

// ---------------------------------------------------------------------------
// Download-Helfer
// ---------------------------------------------------------------------------

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
