// Baut das Scriptable-Widget (widget/src/main.ts) zu EINER Skriptdatei: src/generated/habit-widget.js
// Die Datei enthält Platzhalter (__HT_…__); die App ersetzt sie beim Kopieren durch deine Projekt-URL usw.
import { build } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const result = await build({
  root,
  configFile: false,
  logLevel: 'warn',
  build: {
    write: false,
    minify: false,
    target: 'es2019',
    lib: { entry: join(root, 'widget/src/main.ts'), name: 'HabitWidget', formats: ['iife'], fileName: () => 'habit-widget.js' },
  },
})

const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : result.output
const chunk = outputs.find((o) => o.type === 'chunk')
if (!chunk) throw new Error('Widget-Build: kein Ergebnis')

const header = `// Habit Tracker – Widget für Scriptable (klein und mittel)
// Einrichtung: Skript in Scriptable einfügen, einmal in der App öffnen und anmelden,
// dann ein Scriptable-Widget auf dem Home-Bildschirm hinzufügen und dieses Skript wählen.
`
const code = `${header}${chunk.code}\nawait HabitWidget.run()\n`

const out = join(root, 'src/generated/habit-widget.js')
await mkdir(dirname(out), { recursive: true })
await writeFile(out, code, 'utf8')
console.log(`Widget-Skript gebaut: ${Math.round(code.length / 1024)} KB`)
