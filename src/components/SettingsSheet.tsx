import { ArrowDownUp, CloudOff, Download, FileSpreadsheet, FileUp, LogOut, RefreshCw, Tags } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { backupToCsv, buildBackup, downloadText, importBackup } from '../lib/exportImport'
import { supabaseConfigProblem } from '../lib/supabase'
import { syncNow } from '../lib/sync'
import { todayStr } from '../lib/dates'
import { useTheme } from '../lib/theme'
import { useConfirm } from './Confirm'
import { Sheet } from './Sheet'
import { syncLabel, usePendingCount, useSyncSnapshot } from './SyncBadge'
import { Button, Field, Segmented } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  onCategories: () => void
  onReorder: () => void
}

export function SettingsSheet({ open, onClose, onCategories, onReorder }: Props) {
  const auth = useAuth()
  const confirm = useConfirm()
  const snap = useSyncSnapshot()
  const pending = usePendingCount()
  const [theme, setTheme] = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function exportJson() {
    const b = await buildBackup()
    downloadText(`habit-tracker-${todayStr()}.json`, JSON.stringify(b, null, 2), 'application/json')
    setMsg({ kind: 'ok', text: `${b.habits.length} Gewohnheiten und ${b.completions.length} Einträge exportiert.` })
  }
  async function exportCsv() {
    const b = await buildBackup()
    downloadText(`habit-tracker-${todayStr()}.csv`, backupToCsv(b), 'text/csv')
    setMsg({ kind: 'ok', text: 'CSV exportiert (Trennzeichen Semikolon, für Excel).' })
  }
  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Die Datei ist zu groß.')
      const ok = await confirm({
        title: 'Sicherung importieren?',
        message: 'Vorhandene Daten bleiben bestehen. Gewohnheiten und Einträge mit gleicher ID werden mit der Sicherung überschrieben. Es wird nichts gelöscht.',
        confirmLabel: 'Importieren',
      })
      if (!ok) return
      const r = await importBackup(await file.text())
      setMsg({
        kind: 'ok',
        text: `Importiert: ${r.habits} Gewohnheiten, ${r.completions} Einträge, ${r.categories} Kategorien, ${r.pauses} Pausen${r.skipped ? ` (${r.skipped} ungültige Zeilen übersprungen)` : ''}.`,
      })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function logout() {
    const ok = await confirm({ title: 'Abmelden?', message: 'Die lokalen Daten werden von diesem Gerät entfernt. Auf dem Server bleibt alles erhalten.', confirmLabel: 'Abmelden', danger: true })
    if (!ok) return
    const done = await auth.signOut(() =>
      confirm({
        title: 'Nicht synchronisierte Änderungen',
        message: 'Einige Änderungen konnten noch nicht hochgeladen werden und gehen beim Abmelden verloren. Trotzdem abmelden?',
        confirmLabel: 'Trotzdem abmelden',
        danger: true,
      }),
    )
    if (done) onClose()
  }

  const local = auth.status === 'local'

  return (
    <Sheet open={open} onClose={onClose} title="Einstellungen" size="tall">
      <div className="space-y-6">
        <Field label="Darstellung">
          <Segmented
            label="Darstellung"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'auto', label: 'Automatisch' },
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
          />
          <p className="pl-1 text-xs text-muted">„Automatisch“ folgt der Einstellung deines Geräts. Gilt nur für dieses Gerät.</p>
        </Field>

        <Field label="Konto & Sync">
          <div className="space-y-3 rounded-3xl bg-soft p-4">
            {local ? (
              <p className="flex items-start gap-2 text-sm leading-relaxed">
                <CloudOff size={18} className="mt-0.5 shrink-0 text-[#f59e0b]" />
                <span>
                  {supabaseConfigProblem === 'secret-key'
                    ? 'Der hinterlegte Supabase-Key ist ein geheimer Key (service_role). Er wird aus Sicherheitsgründen nicht verwendet. Bitte den anon / publishable Key eintragen.'
                    : 'Supabase ist nicht konfiguriert. Die Daten bleiben nur auf diesem Gerät. Siehe README, Schritt „Umgebungsvariablen“.'}
                </span>
              </p>
            ) : (
              <div className="text-sm">
                <div className="font-semibold">{auth.email ?? 'Angemeldet'}</div>
                <div className="mt-0.5 text-muted">
                  {syncLabel(snap.status, pending)}
                  {snap.lastSync && snap.status !== 'syncing' && <> · zuletzt {new Date(snap.lastSync).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })} Uhr</>}
                </div>
                {snap.error && <div className="mt-1 text-[#ef4444]">{snap.error}</div>}
              </div>
            )}
            {!local && (
              <Button className="w-full" onClick={() => void syncNow()} disabled={snap.status === 'syncing'}>
                <RefreshCw size={18} className={snap.status === 'syncing' ? 'animate-spin' : ''} /> Jetzt synchronisieren
              </Button>
            )}
          </div>
        </Field>

        <Field label="Organisieren">
          <div className="flex flex-col gap-2">
            <Button onClick={onCategories}>
              <Tags size={18} /> Kategorien verwalten
            </Button>
            <Button onClick={onReorder}>
              <ArrowDownUp size={18} /> Reihenfolge ändern
            </Button>
          </div>
        </Field>

        <Field label="Daten sichern" hint="Backup">
          <div className="flex flex-col gap-2">
            <Button onClick={exportJson}>
              <Download size={18} /> Export als JSON
            </Button>
            <Button onClick={exportCsv}>
              <FileSpreadsheet size={18} /> Export als CSV
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp size={18} /> Import aus JSON
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          {msg && (
            <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.kind === 'ok' ? 'bg-[#22c55e]/12 text-[#16a34a]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
              {msg.text}
            </p>
          )}
        </Field>

        {!local && (
          <Button variant="ghost" className="w-full text-[#ef4444]" onClick={logout}>
            <LogOut size={18} /> Abmelden
          </Button>
        )}
      </div>
    </Sheet>
  )
}
