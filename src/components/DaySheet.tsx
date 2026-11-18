// Tag bearbeiten: Wert (Zähler), erledigt / Rückfall und Notiz – auch rückwirkend.
import { Check } from 'lucide-react'
import { useState } from 'react'
import { colorHex, onColor } from '../lib/catalog'
import { formatLongDE } from '../lib/dates'
import { setCompletion } from '../lib/repo'
import { counterTarget } from '../lib/schedule'
import type { Completion, DateStr, Habit } from '../lib/types'
import { HabitIcon } from './HabitIcon'
import { Sheet } from './Sheet'
import { Button, Field, Stepper, Switch } from './ui'

interface Props {
  habit: Habit | null
  date: DateStr | null
  completion?: Completion
  onClose: () => void
}

export function DaySheet({ habit, date, completion, onClose }: Props) {
  if (!habit || !date) return null
  return <Inner key={`${habit.id}-${date}`} habit={habit} date={date} completion={completion} onClose={onClose} />
}

function Inner({ habit, date, completion, onClose }: { habit: Habit; date: DateStr; completion?: Completion; onClose: () => void }) {
  const hex = colorHex(habit.color)
  const isCounter = habit.type === 'build' && habit.tracking_mode === 'counter'
  const isQuit = habit.type === 'quit'
  const [value, setValue] = useState(completion?.value ?? 0)
  const [note, setNote] = useState(completion?.note ?? '')

  async function save() {
    await setCompletion(habit.id, date, value, note)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Tag bearbeiten"
      footer={
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={onClose}>
            Abbrechen
          </Button>
          <Button size="lg" variant="solid" color={hex} textColor={onColor(hex)} className="flex-[2]" onClick={save}>
            <Check size={20} strokeWidth={3} /> Speichern
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <HabitIcon icon={habit.icon} color={habit.color} size={44} />
          <div className="min-w-0">
            <div className="truncate font-bold">{habit.name}</div>
            <div className="text-sm text-muted">{formatLongDE(date)}</div>
          </div>
        </div>

        {isCounter ? (
          <Field label="Wert" hint={`Ziel: ${counterTarget(habit)} ${habit.unit ?? ''}`}>
            <div className="flex items-center justify-between rounded-2xl bg-soft p-3">
              <Stepper value={value} min={0} max={99999} color={hex} suffix={habit.unit ?? undefined} onChange={setValue} />
              <Button size="sm" className="!bg-soft-raw" onClick={() => setValue(counterTarget(habit))}>
                Ziel
              </Button>
            </div>
          </Field>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-soft p-4">
            <span className="font-semibold">{isQuit ? 'Rückfall an diesem Tag' : 'Erledigt'}</span>
            <Switch checked={value > 0} onChange={(v) => setValue(v ? 1 : 0)} label={isQuit ? 'Rückfall' : 'Erledigt'} />
          </div>
        )}

        <Field label="Notiz" hint="optional">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Wie lief es?"
            className="w-full resize-none rounded-2xl bg-soft px-4 py-3 outline-none placeholder:text-muted/70 focus:ring-2"
            style={{ ['--tw-ring-color' as string]: hex }}
          />
        </Field>
      </div>
    </Sheet>
  )
}
