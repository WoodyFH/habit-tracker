// Schreibzugriffe auf die lokale DB. Jede Änderung:
//  1. setzt updated_at (für "last write wins"),
//  2. markiert die Zeile als _dirty (muss noch hochgeladen werden),
//  3. stößt im Hintergrund einen Sync an.
// Löschen ist immer ein Soft Delete (deleted_at).
import { db, getCurrentUserId } from './db'
import { addDays } from './dates'
import { deterministicId, uuid } from './ids'
import { counterTarget, isDoneValue } from './schedule'
import { requestSync } from './sync'
import type {
  Category,
  Completion,
  DateStr,
  Habit,
  HabitCategory,
  HabitType,
  Local,
  Pause,
  ScheduleConfig,
  ScheduleType,
  TrackingMode,
} from './types'

const nowIso = () => new Date().toISOString()

export interface HabitInput {
  name: string
  description: string | null
  icon: string
  color: string
  type: HabitType
  tracking_mode: TrackingMode
  target_value: number | null
  unit: string | null
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  start_date: DateStr
  end_date: DateStr | null
}

// ---------------------------------------------------------------------------
// Gewohnheiten
// ---------------------------------------------------------------------------

export async function createHabit(input: HabitInput, categoryIds: string[] = []): Promise<string> {
  const id = uuid()
  const now = nowIso()
  await db.transaction('rw', [db.habits, db.habit_categories], async () => {
    const last = await db.habits.orderBy('sort_order').last()
    const habit: Local<Habit> = {
      id,
      user_id: getCurrentUserId(),
      ...input,
      sort_order: (last?.sort_order ?? 0) + 1,
      archived: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _dirty: 1,
    }
    await db.habits.add(habit)
    await writeHabitCategories(id, categoryIds, now)
  })
  requestSync()
  return id
}

export async function updateHabit(id: string, patch: Partial<HabitInput> & { archived?: boolean }, categoryIds?: string[]) {
  const now = nowIso()
  await db.transaction('rw', [db.habits, db.habit_categories], async () => {
    await db.habits.update(id, { ...patch, updated_at: now, _dirty: 1 })
    if (categoryIds) await writeHabitCategories(id, categoryIds, now)
  })
  requestSync()
}

export async function setArchived(id: string, archived: boolean) {
  await updateHabit(id, { archived })
}

/** Soft Delete einer Gewohnheit (Einträge bleiben erhalten, werden aber nicht mehr angezeigt). */
export async function deleteHabit(id: string) {
  const now = nowIso()
  await db.habits.update(id, { deleted_at: now, updated_at: now, _dirty: 1 })
  requestSync()
}

/** Speichert die neue Reihenfolge (nur geänderte Zeilen werden aktualisiert). */
export async function reorderHabits(orderedIds: string[]) {
  const now = nowIso()
  await db.transaction('rw', db.habits, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const h = await db.habits.get(orderedIds[i])
      if (h && h.sort_order !== i + 1) await db.habits.update(h.id, { sort_order: i + 1, updated_at: now, _dirty: 1 })
    }
  })
  requestSync()
}

// ---------------------------------------------------------------------------
// Einträge (completions)
// ---------------------------------------------------------------------------

export function completionId(habitId: string, date: DateStr): string {
  return deterministicId('completion', habitId, date)
}

/**
 * Setzt Wert und/oder Notiz eines Tages. value <= 0 ohne Notiz löscht den Eintrag (Soft Delete).
 * Die ID ist deterministisch (habit_id + date) → es gibt pro Tag immer genau eine Zeile, auch wenn
 * mehrere Geräte offline denselben Tag bearbeiten.
 * Liegt der Tag vor dem Startdatum der Gewohnheit, wird das Startdatum auf diesen Tag vorgezogen.
 */
export async function setCompletion(habitId: string, date: DateStr, value: number, note?: string | null) {
  const id = completionId(habitId, date)
  const now = nowIso()
  await db.transaction('rw', [db.completions, db.habits], async () => {
    const existing = await db.completions.get(id)
    const nextNote = note === undefined ? (existing && !existing.deleted_at ? existing.note : null) : note?.trim() || null
    const remove = !(value > 0) && !nextNote
    if (remove && (!existing || existing.deleted_at)) return
    const row: Local<Completion> = {
      id,
      user_id: existing?.user_id ?? getCurrentUserId(),
      habit_id: habitId,
      date,
      value: Math.max(0, value),
      note: nextNote,
      updated_at: now,
      deleted_at: remove ? now : null,
      _dirty: 1,
    }
    await db.completions.put(row)
    // Rückwirkend eintragen: liegt der Tag vor dem Startdatum, wird der Start auf diesen Tag vorgezogen.
    if (!remove && value > 0) {
      const h = await db.habits.get(habitId)
      if (h && date < h.start_date) await db.habits.update(habitId, { start_date: date, updated_at: now, _dirty: 1 })
    }
  })
  requestSync()
}

export async function setNote(habitId: string, date: DateStr, note: string) {
  const existing = await db.completions.get(completionId(habitId, date))
  const value = existing && !existing.deleted_at ? existing.value : 0
  await setCompletion(habitId, date, value, note)
}

export function valueOn(
  completions: ReadonlyMap<DateStr, Pick<Completion, 'value'>> | undefined,
  date: DateStr,
): number {
  return completions?.get(date)?.value ?? 0
}

/**
 * Antippen eines Tages in Wochenliste/Tabelle:
 *  - Ja/Nein und Abgewöhnen (Rückfall): umschalten
 *  - Zähler: erledigt (Ziel erreicht) ↔ leer
 */
export async function toggleDay(
  habit: Pick<Habit, 'id' | 'type' | 'tracking_mode' | 'target_value'>,
  date: DateStr,
  currentValue: number,
) {
  if (habit.type === 'quit' || habit.tracking_mode !== 'counter') {
    await setCompletion(habit.id, date, currentValue > 0 ? 0 : 1)
  } else {
    await setCompletion(habit.id, date, isDoneValue(habit, currentValue) ? 0 : counterTarget(habit))
  }
}

/** Zähler um delta ändern (mindestens 0). */
export async function bumpCounter(habitId: string, date: DateStr, currentValue: number, delta: number) {
  await setCompletion(habitId, date, Math.max(0, currentValue + delta))
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export async function createCategory(name: string): Promise<string> {
  const id = uuid()
  const now = nowIso()
  const all = await db.categories.toArray()
  const max = all.reduce((m, c) => Math.max(m, c.sort_order), 0)
  await db.categories.add({
    id,
    user_id: getCurrentUserId(),
    name: name.trim(),
    sort_order: max + 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    _dirty: 1,
  })
  requestSync()
  return id
}

export async function renameCategory(id: string, name: string) {
  await db.categories.update(id, { name: name.trim(), updated_at: nowIso(), _dirty: 1 })
  requestSync()
}

export async function deleteCategory(id: string) {
  const now = nowIso()
  await db.transaction('rw', [db.categories, db.habit_categories], async () => {
    await db.categories.update(id, { deleted_at: now, updated_at: now, _dirty: 1 })
    const links = await db.habit_categories.where('category_id').equals(id).toArray()
    for (const l of links) {
      if (!l.deleted_at) await db.habit_categories.update(l.id, { deleted_at: now, updated_at: now, _dirty: 1 })
    }
  })
  requestSync()
}

function linkId(habitId: string, categoryId: string) {
  return deterministicId('habit_category', habitId, categoryId)
}

/** Muss in einer Transaktion über habit_categories laufen. */
async function writeHabitCategories(habitId: string, categoryIds: string[], now: string) {
  const wanted = new Set(categoryIds)
  const existing = await db.habit_categories.where('habit_id').equals(habitId).toArray()
  for (const l of existing) {
    const shouldBeActive = wanted.has(l.category_id)
    const isActive = !l.deleted_at
    if (shouldBeActive && !isActive) {
      await db.habit_categories.update(l.id, { deleted_at: null, updated_at: now, _dirty: 1 })
    } else if (!shouldBeActive && isActive) {
      await db.habit_categories.update(l.id, { deleted_at: now, updated_at: now, _dirty: 1 })
    }
    wanted.delete(l.category_id)
  }
  for (const categoryId of wanted) {
    const row: Local<HabitCategory> = {
      id: linkId(habitId, categoryId),
      user_id: getCurrentUserId(),
      habit_id: habitId,
      category_id: categoryId,
      updated_at: now,
      deleted_at: null,
      _dirty: 1,
    }
    await db.habit_categories.put(row)
  }
}

// ---------------------------------------------------------------------------
// Pausen
// ---------------------------------------------------------------------------

export async function addPause(habitId: string, from: DateStr, to: DateStr): Promise<string> {
  const id = uuid()
  const lo = from <= to ? from : to
  const hi = from <= to ? to : from
  await db.pauses.add({
    id,
    user_id: getCurrentUserId(),
    habit_id: habitId,
    from_date: lo,
    to_date: hi,
    updated_at: nowIso(),
    deleted_at: null,
    _dirty: 1,
  })
  requestSync()
  return id
}

export async function updatePause(id: string, from: DateStr, to: DateStr) {
  const lo = from <= to ? from : to
  const hi = from <= to ? to : from
  await db.pauses.update(id, { from_date: lo, to_date: hi, updated_at: nowIso(), _dirty: 1 })
  requestSync()
}

export async function removePause(id: string) {
  const now = nowIso()
  await db.pauses.update(id, { deleted_at: now, updated_at: now, _dirty: 1 })
  requestSync()
}

/** Beendet eine laufende Pause gestern (oder löscht sie, wenn sie erst heute beginnt). */
export async function endPauseToday(id: string, today: DateStr) {
  const p = await db.pauses.get(id)
  if (!p) return
  if (p.from_date >= today) await removePause(id)
  else await updatePause(id, p.from_date, addDays(today, -1))
}

export type { Category, Pause }
