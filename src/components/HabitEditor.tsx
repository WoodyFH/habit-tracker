// Bottom Sheet zum Anlegen und Bearbeiten einer Gewohnheit.
import { Archive, ArchiveRestore, CalendarX2, Check, ChevronDown, PauseCircle, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { colorHex, COLORS, DEFAULT_COLOR, DEFAULT_ICON, ICONS, onColor } from '../lib/catalog'
import { useData } from '../lib/dataContext'
import { addDays, formatDateDE, WEEKDAY_SHORT, WEEKDAY_LONG } from '../lib/dates'
import {
  addPause,
  createCategory,
  createHabit,
  deleteHabit,
  removePause,
  setArchived,
  updateHabit,
  updatePause,
  type HabitInput,
} from '../lib/repo'
import { describeSchedule } from '../lib/schedule'
import type { Habit, HabitType, ScheduleType, TrackingMode } from '../lib/types'
import { useConfirm } from './Confirm'
import { HabitIcon } from './HabitIcon'
import { Sheet } from './Sheet'
import { Button, Chip, cx, Field, Segmented, Stepper, TextInput } from './ui'

interface Props {
  /** undefined = neue Gewohnheit */
  habit?: Habit
  open: boolean
  onClose: () => void
}

const SCHEDULE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'daily', label: 'Jeden Tag' },
  { value: 'weekdays', label: 'Wochentage' },
  { value: 'times_per_week', label: 'X× pro Woche' },
  { value: 'times_per_month', label: 'X× pro Monat' },
  { value: 'every_n_days', label: 'Alle N Tage' },
]

interface FormState {
  name: string
  description: string
  icon: string
  color: string
  type: HabitType
  tracking_mode: TrackingMode
  target_value: number
  unit: string
  schedule_type: ScheduleType
  weekdays: number[]
  times: number
  interval: number
  start_date: string
  end_date: string
  categoryIds: string[]
}

function initialState(habit: Habit | undefined, today: string): FormState {
  if (!habit) {
    return {
      name: '',
      description: '',
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      type: 'build',
      tracking_mode: 'yes_no',
      target_value: 8,
      unit: '',
      schedule_type: 'daily',
      weekdays: [1, 2, 3, 4, 5],
      times: 3,
      interval: 2,
      start_date: today,
      end_date: '',
      categoryIds: [],
    }
  }
  const c = habit.schedule_config ?? {}
  return {
    name: habit.name,
    description: habit.description ?? '',
    icon: habit.icon,
    color: habit.color,
    type: habit.type,
    tracking_mode: habit.tracking_mode === 'measurement' ? 'yes_no' : habit.tracking_mode,
    target_value: habit.target_value ?? 8,
    unit: habit.unit ?? '',
    schedule_type: habit.schedule_type,
    weekdays: c.weekdays?.length ? c.weekdays : [1, 2, 3, 4, 5],
    times: c.times ?? 3,
    interval: c.interval ?? 2,
    start_date: habit.start_date,
    end_date: habit.end_date ?? '',
    categoryIds: [],
  }
}

export function HabitEditor(props: Props) {
  // Beim Öffnen frisch initialisieren (key sorgt für neuen State pro Gewohnheit / pro Öffnen)
  if (!props.open) return null
  return <EditorInner key={props.habit?.id ?? 'new'} {...props} />
}

function EditorInner({ habit, open, onClose }: Props) {
  const data = useData()
  const confirm = useConfirm()
  const [f, setF] = useState<FormState>(() => ({
    ...initialState(habit, data.today),
    categoryIds: habit ? (data.categoryIdsByHabit.get(habit.id) ?? []) : [],
  }))
  const [iconOpen, setIconOpen] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const hex = colorHex(f.color)
  const fg = onColor(hex)
  const isQuit = f.type === 'quit'

  const preview = useMemo(() => {
    if (isQuit) return 'Jeden Tag zählt, an dem du nicht rückfällig wirst.'
    const h = {
      type: f.type,
      tracking_mode: f.tracking_mode,
      target_value: f.target_value,
      schedule_type: f.schedule_type,
      schedule_config: { weekdays: f.weekdays, times: f.times, interval: f.interval },
      start_date: f.start_date,
      end_date: null,
    } as const
    switch (f.schedule_type) {
      case 'daily':
        return 'Fällig an jedem Tag.'
      case 'weekdays':
        return f.weekdays.length ? `Fällig jeden ${[...f.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_LONG[d - 1]).join(', ')}.` : 'Wähle mindestens einen Wochentag.'
      case 'times_per_week':
        return `${describeSchedule(h)} – an beliebigen Tagen (Woche: Montag bis Sonntag). Serie in Wochen.`
      case 'times_per_month':
        return `${describeSchedule(h)} – an beliebigen Tagen im Kalendermonat. Serie in Monaten.`
      case 'every_n_days':
        return `Fällig, sobald seit der letzten Erledigung ${f.interval} Tage vergangen sind.`
    }
  }, [f, isQuit])

  async function save() {
    const name = f.name.trim()
    if (!name) return setError('Bitte gib einen Namen ein.')
    if (!isQuit && f.schedule_type === 'weekdays' && f.weekdays.length === 0) return setError('Wähle mindestens einen Wochentag.')
    if (!f.start_date) return setError('Bitte ein Startdatum wählen.')
    if (f.end_date && f.end_date < f.start_date) return setError('Das Enddatum liegt vor dem Startdatum.')
    if (!isQuit && f.tracking_mode === 'counter' && !(f.target_value >= 1)) return setError('Das Tagesziel muss mindestens 1 sein.')

    const scheduleType: ScheduleType = isQuit ? 'daily' : f.schedule_type
    const input: HabitInput = {
      name,
      description: f.description.trim() || null,
      icon: f.icon,
      color: f.color,
      type: f.type,
      tracking_mode: isQuit ? 'yes_no' : f.tracking_mode,
      target_value: !isQuit && f.tracking_mode === 'counter' ? f.target_value : null,
      unit: !isQuit && f.tracking_mode === 'counter' ? f.unit.trim() || null : null,
      schedule_type: scheduleType,
      schedule_config:
        scheduleType === 'weekdays'
          ? { weekdays: [...f.weekdays].sort((a, b) => a - b) }
          : scheduleType === 'times_per_week' || scheduleType === 'times_per_month'
            ? { times: f.times }
            : scheduleType === 'every_n_days'
              ? { interval: f.interval }
              : {},
      start_date: f.start_date,
      end_date: f.end_date || null,
    }
    setBusy(true)
    try {
      if (habit) await updateHabit(habit.id, input, f.categoryIds)
      else await createHabit(input, f.categoryIds)
      onClose()
    } catch (e) {
      setError(`Speichern fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    const name = newCat.trim()
    if (!name) return
    const existing = data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    const id = existing?.id ?? (await createCategory(name))
    setF((s) => ({ ...s, categoryIds: s.categoryIds.includes(id) ? s.categoryIds : [...s.categoryIds, id] }))
    setNewCat('')
  }

  async function remove() {
    if (!habit) return
    const ok = await confirm({
      title: 'Gewohnheit löschen?',
      message: `„${habit.name}“ wird auf allen Geräten ausgeblendet. Tipp: Mit „Archivieren“ bleibt alles erhalten.`,
      confirmLabel: 'Löschen',
      danger: true,
    })
    if (ok) {
      await deleteHabit(habit.id)
      onClose()
    }
  }

  const pauses = habit ? (data.pausesByHabit.get(habit.id) ?? []) : []
  const Icon = ICONS[f.icon]?.icon

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}
      size="tall"
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="rounded-xl bg-[#ef4444]/10 px-3 py-2 text-sm font-medium text-[#ef4444]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={onClose}>
              Abbrechen
            </Button>
            <Button size="lg" variant="solid" color={hex} textColor={fg} className="flex-[2]" disabled={busy} onClick={save}>
              <Check size={20} strokeWidth={3} /> Speichern
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-w-0 space-y-5" style={{ ['--ring' as string]: hex }}>
        {/* Icon + Name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIconOpen((v) => !v)}
            aria-label="Icon ändern"
            aria-expanded={iconOpen}
            className="press relative shrink-0"
          >
            <HabitIcon icon={f.icon} color={f.color} size={56} />
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-card text-muted shadow-card">
              <ChevronDown size={13} className={cx('transition-transform', iconOpen && 'rotate-180')} />
            </span>
          </button>
          <TextInput
            value={f.name}
            onChange={(e) => {
              set('name', e.target.value)
              setError(null)
            }}
            placeholder="Name, z. B. Wasser trinken"
            aria-label="Name"
            maxLength={80}
            autoFocus={!habit}
            className="h-14 text-lg font-semibold"
          />
        </div>

        {iconOpen && (
          <div className="grid grid-cols-6 gap-2 rounded-3xl bg-soft p-3 sm:grid-cols-8" role="listbox" aria-label="Icon wählen">
            {Object.entries(ICONS).map(([key, { label, icon: I }]) => (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={f.icon === key}
                aria-label={label}
                title={label}
                onClick={() => {
                  set('icon', key)
                  setIconOpen(false)
                }}
                className={cx('press grid aspect-square place-items-center rounded-2xl', f.icon === key ? 'text-white' : 'bg-soft-raw text-ink')}
                style={f.icon === key ? { background: hex, color: fg } : undefined}
              >
                <I size={20} />
              </button>
            ))}
          </div>
        )}
        {Icon === undefined && <p className="text-xs text-muted">Unbekanntes Icon – wähle ein neues.</p>}

        <Field label="Beschreibung" hint="optional">
          <textarea
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Wofür machst du das?"
            className="w-full resize-none rounded-2xl bg-soft px-4 py-3 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-[var(--ring)]"
          />
        </Field>

        {/* Farbe */}
        <Field label="Farbe">
          <div className="grid grid-cols-7 gap-2.5" role="radiogroup" aria-label="Farbe">
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={f.color === c.key}
                aria-label={c.name}
                title={c.name}
                onClick={() => set('color', c.key)}
                className="press grid aspect-square place-items-center rounded-2xl"
                style={{ background: c.hex, color: onColor(c.hex), boxShadow: f.color === c.key ? `0 0 0 3px var(--card), 0 0 0 5px ${c.hex}` : undefined }}
              >
                {f.color === c.key && <Check size={18} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Field>

        {/* Art */}
        <Field label="Art">
          <Segmented
            label="Art"
            value={f.type}
            onChange={(v) => set('type', v)}
            color={hex}
            textColor={fg}
            options={[
              { value: 'build', label: 'Aufbauen' },
              { value: 'quit', label: 'Abgewöhnen' },
            ]}
          />
          <p className="text-xs leading-relaxed text-muted">
            {isQuit
              ? 'Gezählt werden Tage ohne Rückfall. Jeder Tag gilt als geschafft, bis du einen Rückfall einträgst.'
              : 'Du markierst jeden Tag, an dem du die Gewohnheit erledigt hast.'}
          </p>
        </Field>

        {/* Wiederholung */}
        {!isQuit && (
          <Field label="Wiederholung">
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_OPTIONS.map((o) => (
                <Chip key={o.value} active={f.schedule_type === o.value} color={hex} textColor={fg} onClick={() => set('schedule_type', o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>

            {f.schedule_type === 'weekdays' && (
              <div className="mt-3 flex gap-1.5" role="group" aria-label="Wochentage">
                {WEEKDAY_SHORT.map((d, i) => {
                  const day = i + 1
                  const on = f.weekdays.includes(day)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={WEEKDAY_LONG[i]}
                      onClick={() => set('weekdays', on ? f.weekdays.filter((x) => x !== day) : [...f.weekdays, day])}
                      className={cx('press h-12 min-w-0 flex-1 rounded-2xl text-sm font-bold', !on && 'bg-soft text-muted')}
                      style={on ? { background: hex, color: fg } : undefined}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            )}

            {(f.schedule_type === 'times_per_week' || f.schedule_type === 'times_per_month') && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-soft p-3">
                <span className="text-sm font-semibold">Wie oft?</span>
                <Stepper
                  value={f.times}
                  min={1}
                  max={f.schedule_type === 'times_per_week' ? 7 : 31}
                  suffix={f.schedule_type === 'times_per_week' ? '× / Woche' : '× / Monat'}
                  color={hex}
                  onChange={(v) => set('times', v)}
                />
              </div>
            )}

            {f.schedule_type === 'every_n_days' && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-soft p-3">
                <span className="text-sm font-semibold">Alle</span>
                <Stepper value={f.interval} min={2} max={365} suffix="Tage" color={hex} onChange={(v) => set('interval', v)} />
              </div>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted">{preview}</p>
          </Field>
        )}

        {/* Erfassung */}
        {!isQuit && (
          <Field label="Erfassung">
            <Segmented
              label="Erfassung"
              value={f.tracking_mode === 'measurement' ? 'yes_no' : f.tracking_mode}
              onChange={(v) => set('tracking_mode', v)}
              color={hex}
              textColor={fg}
              options={[
                { value: 'yes_no', label: 'Ja / Nein' },
                { value: 'counter', label: 'Zähler' },
              ]}
            />
            {f.tracking_mode === 'counter' && (
              <div className="mt-3 space-y-3 rounded-2xl bg-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Tagesziel</span>
                  <Stepper value={f.target_value} min={1} max={9999} color={hex} onChange={(v) => set('target_value', v)} />
                </div>
                <TextInput
                  value={f.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  placeholder="Einheit (optional), z. B. Gläser"
                  aria-label="Einheit"
                  maxLength={20}
                  className="!bg-soft-raw"
                />
              </div>
            )}
          </Field>
        )}

        {/* Kategorien */}
        <Field label="Kategorien" hint="mehrere möglich">
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => (
              <Chip
                key={c.id}
                active={f.categoryIds.includes(c.id)}
                color={hex}
                textColor={fg}
                onClick={() => set('categoryIds', f.categoryIds.includes(c.id) ? f.categoryIds.filter((x) => x !== c.id) : [...f.categoryIds, c.id])}
              >
                {c.name}
              </Chip>
            ))}
            {data.categories.length === 0 && <span className="text-sm text-muted">Noch keine Kategorien.</span>}
          </div>
          <div className="mt-2 flex gap-2">
            <TextInput
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addCategory()
                }
              }}
              placeholder="Neue Kategorie"
              aria-label="Neue Kategorie"
              maxLength={40}
            />
            <Button aria-label="Kategorie hinzufügen" disabled={!newCat.trim()} onClick={addCategory} className="w-12 shrink-0 px-0">
              <Plus size={20} />
            </Button>
          </div>
        </Field>

        {/* Zeitraum */}
        <Field label="Zeitraum">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <label className="min-w-0 space-y-1">
              <span className="text-xs font-medium text-muted">Start</span>
              <TextInput type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </label>
            <label className="min-w-0 space-y-1">
              <span className="text-xs font-medium text-muted">Ende (optional)</span>
              <div className="relative">
                <TextInput type="date" value={f.end_date} min={f.start_date} onChange={(e) => set('end_date', e.target.value)} className={f.end_date ? 'pr-11' : ''} />
                {f.end_date && (
                  <button
                    type="button"
                    aria-label="Enddatum entfernen"
                    onClick={() => set('end_date', '')}
                    className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-card text-muted"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </label>
          </div>
        </Field>

        {/* Pausen & Archiv (nur beim Bearbeiten) */}
        {habit && (
          <>
            <Field label="Pausen" hint="z. B. Urlaub">
              <p className="text-xs leading-relaxed text-muted">
                In einer Pause reißt die Serie nicht und es zählen keine Tage als verpasst.
              </p>
              <div className="space-y-2">
                {pauses.map((p) => (
                  <div key={p.id} className="flex min-w-0 items-center gap-1.5 rounded-2xl bg-soft p-2">
                    <PauseCircle size={18} className="ml-0.5 shrink-0 text-muted" />
                    <input
                      type="date"
                      aria-label="Pause von"
                      value={p.from_date}
                      max={p.to_date}
                      onChange={(e) => e.target.value && void updatePause(p.id, e.target.value, p.to_date)}
                      className="h-10 min-w-0 flex-1 rounded-xl bg-soft-raw px-2 text-sm outline-none"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="date"
                      aria-label="Pause bis"
                      value={p.to_date}
                      min={p.from_date}
                      onChange={(e) => e.target.value && void updatePause(p.id, p.from_date, e.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-xl bg-soft-raw px-2 text-sm outline-none"
                    />
                    <button type="button" aria-label="Pause löschen" onClick={() => removePause(p.id)} className="press grid size-9 shrink-0 place-items-center rounded-xl bg-soft-raw text-muted">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => addPause(habit.id, data.today, addDays(data.today, 6))}>
                  <PauseCircle size={16} /> Eine Woche pausieren
                </Button>
                <Button size="sm" onClick={() => addPause(habit.id, data.today, addDays(data.today, 13))}>
                  <CalendarX2 size={16} /> Zwei Wochen
                </Button>
              </div>
              {pauses.length > 0 && <p className="text-xs text-muted">Zuletzt: {formatDateDE(pauses[pauses.length - 1].from_date)} – {formatDateDE(pauses[pauses.length - 1].to_date)}</p>}
            </Field>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={async () => {
                  await setArchived(habit.id, !habit.archived)
                  onClose()
                }}
              >
                {habit.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />} {habit.archived ? 'Wiederherstellen' : 'Archivieren'}
              </Button>
              <Button variant="ghost" className="text-[#ef4444]" onClick={remove}>
                <Trash2 size={18} /> Löschen
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
