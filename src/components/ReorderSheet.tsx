// Reihenfolge der Gewohnheiten per Drag and Drop ändern (am Griff ziehen; auch per Tastatur: Fokus auf Griff, Leertaste, Pfeiltasten).
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../lib/dataContext'
import { reorderHabits } from '../lib/repo'
import type { Habit } from '../lib/types'
import { HabitIcon } from './HabitIcon'
import { Sheet } from './Sheet'

export function ReorderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <Inner onClose={onClose} />
}

function Inner({ onClose }: { onClose: () => void }) {
  const data = useData()
  const [order, setOrder] = useState<string[]>(() => data.habits.map((h) => h.id))
  const byId = new Map(data.habits.map((h) => [h.id, h]))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setOrder(next)
    void reorderHabits(next)
  }

  return (
    <Sheet open onClose={onClose} title="Reihenfolge" size="tall">
      <p className="mb-4 text-sm text-muted">Ziehe eine Gewohnheit am Griff nach oben oder unten.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {order.map((id) => {
              const h = byId.get(id)
              return h ? <Row key={id} habit={h} /> : null
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </Sheet>
  )
}

function Row({ habit }: { habit: Habit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 rounded-2xl bg-soft p-2.5 ${isDragging ? 'shadow-float' : ''} ${habit.archived ? 'opacity-60' : ''}`}
    >
      <HabitIcon icon={habit.icon} color={habit.color} size={40} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        {habit.name}
        {habit.archived && <span className="ml-2 text-xs font-normal text-muted">Archiviert</span>}
      </span>
      <button
        type="button"
        aria-label={`${habit.name} verschieben`}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={22} />
      </button>
    </li>
  )
}
