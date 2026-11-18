import { BarChart3, CalendarDays, LayoutGrid, Plus, Settings, SlidersHorizontal, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmProvider } from './components/Confirm'
import { CategorySheet } from './components/CategorySheet'
import { DaySheet } from './components/DaySheet'
import { FilterSheet } from './components/FilterSheet'
import { HabitEditor } from './components/HabitEditor'
import { HistorySheet } from './components/HistorySheet'
import { LoginScreen } from './components/LoginScreen'
import { ReorderSheet } from './components/ReorderSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { StatsSheet } from './components/StatsSheet'
import { SyncBadge } from './components/SyncBadge'
import { Chip, cx, IconButton } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider, useData } from './lib/dataContext'
import { formatMedDE } from './lib/dates'
import { filterHabits } from './lib/filters'
import { usePrefs, type ViewKey } from './lib/prefs'
import type { DateStr, Habit } from './lib/types'
import { CardsView } from './views/CardsView'
import { TableView } from './views/TableView'
import { WeekView } from './views/WeekView'

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Gate />
      </ConfirmProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted" role="status">
        Lade …
      </div>
    )
  }
  if (status === 'out') return <LoginScreen />
  return (
    <DataProvider>
      <Main />
    </DataProvider>
  )
}

const NAV: Array<{ key: ViewKey; label: string; icon: typeof LayoutGrid }> = [
  { key: 'cards', label: 'Karten', icon: LayoutGrid },
  { key: 'week', label: 'Woche', icon: CalendarDays },
  { key: 'table', label: 'Tabelle', icon: Table2 },
]

function Main() {
  const data = useData()
  const [prefs, update] = usePrefs()
  const [editor, setEditor] = useState<{ open: boolean; habit?: Habit }>({ open: false })
  const [day, setDay] = useState<{ habit: Habit; date: DateStr } | null>(null)
  const [history, setHistory] = useState<Habit | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)

  const visible = useMemo(
    () => filterHabits(data.habits, data.ctxById, data.categoryIdsByHabit, data.categories, prefs, data.today),
    [data.habits, data.ctxById, data.categoryIdsByHabit, data.categories, prefs, data.today],
  )
  const liveCategoryIds = useMemo(() => new Set(data.categories.map((c) => c.id)), [data.categories])
  const activeCats = prefs.categoryIds.filter((id) => liveCategoryIds.has(id))
  const filtersActive = prefs.onlyDue || prefs.showArchived || activeCats.length > 0

  const openNew = () => setEditor({ open: true })
  const openEdit = (habit: Habit) => setEditor({ open: true, habit })
  const openDay = (habit: Habit, date: DateStr) => setDay({ habit, date })
  const toggleCat = (id: string) =>
    update({ categoryIds: activeCats.includes(id) ? activeCats.filter((x) => x !== id) : [...activeCats, id] })

  const dayCompletion = day ? data.completionsByHabit.get(day.habit.id)?.get(day.date) : undefined

  return (
    <div className="pl-safe pr-safe min-h-dvh">
      {/* Kopfzeile */}
      <header className="pt-safe sticky top-0 z-30 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-2.5 pb-1.5">
          <IconButton label="Einstellungen" onClick={() => setSettingsOpen(true)}>
            <Settings size={19} />
          </IconButton>
          <div className="min-w-0 flex-1 pl-1.5 leading-tight">
            <div className="truncate text-[12.5px] font-semibold text-muted">{formatMedDE(data.today)}</div>
            <SyncBadge onClick={() => setSettingsOpen(true)} />
          </div>
          <IconButton label="Filter" onClick={() => setFilterOpen(true)} className="relative">
            <SlidersHorizontal size={18} />
            {filtersActive && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#6366f1] ring-2 ring-[var(--card)]" />}
          </IconButton>
          <IconButton label="Statistik" onClick={() => setStatsOpen(true)}>
            <BarChart3 size={18} />
          </IconButton>
          <IconButton label="Neue Gewohnheit" onClick={openNew} className="!bg-[#6366f1] !text-white">
            <Plus size={22} strokeWidth={2.6} />
          </IconButton>
        </div>
        {data.categories.length > 0 && (
          <nav aria-label="Kategorien" className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pt-0.5 pb-2.5">
            <Chip active={activeCats.length === 0} onClick={() => update({ categoryIds: [] })}>
              Alle
            </Chip>
            {data.categories.map((c) => (
              <Chip key={c.id} active={activeCats.includes(c.id)} onClick={() => toggleCat(c.id)}>
                {c.name}
              </Chip>
            ))}
          </nav>
        )}
      </header>

      {/* Inhalt */}
      <main className={cx('mx-auto px-4 pt-1.5 pb-28', prefs.view === 'cards' ? 'max-w-5xl' : prefs.view === 'week' ? 'max-w-xl' : 'max-w-4xl')}>
        {!data.ready ? (
          <p className="py-20 text-center text-sm text-muted" role="status">
            Lade Daten …
          </p>
        ) : prefs.view === 'cards' ? (
          <CardsView habits={visible} filtered={filtersActive} onEdit={openEdit} onDay={openDay} onHistory={setHistory} onNew={openNew} />
        ) : prefs.view === 'week' ? (
          <WeekView habits={visible} prefs={prefs} update={update} onEdit={openEdit} onDay={openDay} />
        ) : (
          <TableView habits={visible} prefs={prefs} update={update} onEdit={openEdit} onDay={openDay} />
        )}
      </main>

      {/* Schwebende Leiste */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <nav aria-label="Ansicht" className="pointer-events-auto flex gap-1 rounded-full bg-card p-1 shadow-float">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = prefs.view === key
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                title={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => update({ view: key })}
                className={cx('press grid h-11 w-[58px] place-items-center rounded-full', active ? 'bg-soft-raw text-ink' : 'text-muted')}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </button>
            )
          })}
        </nav>
      </div>

      <HabitEditor open={editor.open} habit={editor.habit} onClose={() => setEditor({ open: false })} />
      <DaySheet habit={day?.habit ?? null} date={day?.date ?? null} completion={dayCompletion} onClose={() => setDay(null)} />
      <HistorySheet habit={history} onClose={() => setHistory(null)} onDay={openDay} />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        prefs={prefs}
        update={update}
        onCategories={() => setCategoriesOpen(true)}
        onReorder={() => setReorderOpen(true)}
      />
      <StatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onCategories={() => setCategoriesOpen(true)} onReorder={() => setReorderOpen(true)} />
      <CategorySheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ReorderSheet open={reorderOpen} onClose={() => setReorderOpen(false)} />
    </div>
  )
}
