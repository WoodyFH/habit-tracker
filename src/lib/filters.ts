// Filter für die Hauptansichten (Kategorien, nur heute fällige, archivierte).
import { todayInfo, type HabitContext } from './schedule'
import type { Prefs } from './prefs'
import type { Category, DateStr, Habit } from './types'

export function filterHabits(
  habits: Habit[],
  ctxById: Map<string, HabitContext>,
  categoryIdsByHabit: Map<string, string[]>,
  categories: Category[],
  prefs: Pick<Prefs, 'categoryIds' | 'onlyDue' | 'showArchived'>,
  today: DateStr,
): Habit[] {
  const live = new Set(categories.map((c) => c.id))
  const selected = prefs.categoryIds.filter((id) => live.has(id))
  const out = habits.filter((h) => {
    if (h.archived && !prefs.showArchived) return false
    if (selected.length > 0 && !(categoryIdsByHabit.get(h.id) ?? []).some((id) => selected.includes(id))) return false
    if (prefs.onlyDue) {
      if (h.archived) return false
      const ctx = ctxById.get(h.id)
      if (!ctx || !todayInfo(ctx, today).dueToday) return false
    }
    return true
  })
  // Archivierte ans Ende (Reihenfolge sonst unverändert)
  return [...out.filter((h) => !h.archived), ...out.filter((h) => h.archived)]
}
