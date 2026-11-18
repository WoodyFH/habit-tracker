// Dezente Anzeige des Sync-Status: offline / synchronisiert / Fehler.
import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { countDirty } from '../lib/db'
import { getSyncSnapshot, subscribeSync, type SyncStatus } from '../lib/sync'

export function useSyncSnapshot() {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot)
}

export function usePendingCount(): number {
  return useLiveQuery(() => countDirty(), [], 0) ?? 0
}

const META: Record<SyncStatus, { label: string; color: string }> = {
  local: { label: 'Nur lokal', color: '#f59e0b' },
  idle: { label: 'Bereit', color: '#9ca3af' },
  syncing: { label: 'Synchronisiere …', color: '#3b82f6' },
  synced: { label: 'Synchronisiert', color: '#22c55e' },
  offline: { label: 'Offline', color: '#9ca3af' },
  error: { label: 'Sync-Fehler', color: '#ef4444' },
}

export function syncLabel(status: SyncStatus, pending: number): string {
  const base = META[status].label
  return pending > 0 && status !== 'syncing' && status !== 'synced' && status !== 'local' ? `${base} · ${pending} offen` : base
}

export function SyncBadge({ onClick }: { onClick?: () => void }) {
  const snap = useSyncSnapshot()
  const pending = usePendingCount()
  const m = META[snap.status]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sync-Status: ${syncLabel(snap.status, pending)}`}
      title={snap.error ?? undefined}
      className="press inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted"
    >
      <span className={`size-2 rounded-full ${snap.status === 'syncing' ? 'animate-pulse' : ''}`} style={{ background: m.color }} />
      {syncLabel(snap.status, pending)}
    </button>
  )
}
