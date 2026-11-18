import { ArrowDownUp, Tags } from 'lucide-react'
import { useData } from '../lib/dataContext'
import type { Prefs } from '../lib/prefs'
import { Sheet } from './Sheet'
import { Button, Chip, Field, Switch } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  prefs: Prefs
  update: (p: Partial<Prefs>) => void
  onCategories: () => void
  onReorder: () => void
}

export function FilterSheet({ open, onClose, prefs, update, onCategories, onReorder }: Props) {
  const data = useData()
  const toggleCat = (id: string) =>
    update({ categoryIds: prefs.categoryIds.includes(id) ? prefs.categoryIds.filter((x) => x !== id) : [...prefs.categoryIds, id] })

  return (
    <Sheet open={open} onClose={onClose} title="Filter">
      <div className="space-y-6">
        <div className="space-y-1 rounded-3xl bg-soft p-2">
          <Row label="Nur heute fällige" hint="Blendet aus, was heute laut Plan nicht dran ist." checked={prefs.onlyDue} onChange={(v) => update({ onlyDue: v })} />
          <Row label="Archivierte anzeigen" hint="Archivierte Gewohnheiten erscheinen am Ende." checked={prefs.showArchived} onChange={(v) => update({ showArchived: v })} />
        </div>

        <Field label="Kategorien">
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => (
              <Chip key={c.id} active={prefs.categoryIds.includes(c.id)} onClick={() => toggleCat(c.id)}>
                {c.name}
              </Chip>
            ))}
            {data.categories.length === 0 && <span className="text-sm text-muted">Noch keine Kategorien.</span>}
          </div>
        </Field>

        <div className="flex flex-col gap-2">
          <Button onClick={onCategories}>
            <Tags size={18} /> Kategorien verwalten
          </Button>
          <Button onClick={onReorder}>
            <ArrowDownUp size={18} /> Reihenfolge ändern
          </Button>
          {(prefs.onlyDue || prefs.showArchived || prefs.categoryIds.length > 0) && (
            <Button variant="ghost" onClick={() => update({ onlyDue: false, showArchived: false, categoryIds: [] })}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function Row({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl px-3 py-3">
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
