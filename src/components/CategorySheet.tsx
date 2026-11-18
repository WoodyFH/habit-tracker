// Kategorien verwalten: anlegen, umbenennen, löschen.
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../lib/dataContext'
import { createCategory, deleteCategory, renameCategory } from '../lib/repo'
import { useConfirm } from './Confirm'
import { Sheet } from './Sheet'
import { Button, TextInput } from './ui'

export function CategorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const counts = new Map<string, number>()
  for (const ids of data.categoryIdsByHabit.values()) for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)

  async function add() {
    const n = name.trim()
    if (!n) return
    if (!data.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) await createCategory(n)
    setName('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Kategorien">
      <div className="space-y-3">
        {data.categories.length === 0 && <p className="text-sm text-muted">Noch keine Kategorien. Lege unten die erste an.</p>}
        {data.categories.map((c) => (
          <CategoryRow
            key={c.id}
            name={c.name}
            count={counts.get(c.id) ?? 0}
            onRename={(n) => renameCategory(c.id, n)}
            onDelete={async () => {
              const ok = await confirm({
                title: 'Kategorie löschen?',
                message: `„${c.name}“ wird entfernt. Die Gewohnheiten selbst bleiben erhalten.`,
                confirmLabel: 'Löschen',
                danger: true,
              })
              if (ok) await deleteCategory(c.id)
            }}
          />
        ))}
        <div className="flex gap-2 pt-2">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="Neue Kategorie"
            aria-label="Neue Kategorie"
            maxLength={40}
          />
          <Button variant="solid" aria-label="Hinzufügen" disabled={!name.trim()} onClick={add} className="w-14 shrink-0 px-0">
            <Plus size={22} />
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function CategoryRow({ name, count, onRename, onDelete }: { name: string; count: number; onRename: (n: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(name)
  const commit = () => {
    const n = value.trim()
    if (!n) setValue(name)
    else if (n !== name) onRename(n)
  }
  return (
    <div className="flex items-center gap-2">
      <TextInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Kategoriename"
        maxLength={40}
      />
      <span className="w-8 shrink-0 text-center text-xs text-muted tabular-nums" title="Gewohnheiten">
        {count}
      </span>
      <button type="button" aria-label="Kategorie löschen" onClick={onDelete} className="press grid size-12 shrink-0 place-items-center rounded-2xl bg-soft text-muted">
        <Trash2 size={18} />
      </button>
    </div>
  )
}
