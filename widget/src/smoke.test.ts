// Rauchtest: Das fertig gebaute Skript (src/generated/habit-widget.js) läuft hier in Node gegen eine Attrappe der Scriptable-API.
// Geprüft wird, dass es ohne Laufzeitfehler durchläuft und die richtigen Elemente erzeugt. Das echte Zeichnen auf dem iPhone ist damit NICHT getestet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import raw from '../../src/generated/habit-widget.js?raw'
import { fillWidgetTemplate } from '../../src/lib/widgetScript'

class Node {
  [k: string]: any
  kind: string
  text?: string
  children: Node[] = []
  constructor(kind: string) {
    this.kind = kind
  }
  addStack() {
    const n = new Node('stack')
    this.children.push(n)
    return n
  }
  addText(t: string) {
    const n = new Node('text')
    n.text = t
    this.children.push(n)
    return n
  }
  addSpacer(len?: number) {
    const n = new Node('spacer')
    n.len = len
    this.children.push(n)
  }
  layoutHorizontally() {}
  layoutVertically() {}
  bottomAlignContent() {}
  centerAlignContent() {}
  setPadding() {}
}

function walk(n: Node, out: Node[] = []): Node[] {
  out.push(n)
  n.children.forEach((c) => walk(c, out))
  return out
}

const CFG = { supabaseUrl: 'https://test.supabase.co', anonKey: 'anon-key-123', appUrl: 'https://example.github.io/habit-tracker/' }
const script = fillWidgetTemplate(raw, CFG)

const habit = (id: string, name: string, order: number, over: Record<string, unknown> = {}) => ({
  id,
  name,
  color: 'blue',
  icon: 'check',
  type: 'build',
  tracking_mode: 'yes_no',
  target_value: null,
  unit: null,
  schedule_type: 'daily',
  schedule_config: {},
  start_date: '2026-01-01',
  end_date: null,
  archived: false,
  deleted_at: null,
  sort_order: order,
  ...over,
})

interface Opts {
  family?: string
  creds?: boolean
  token?: { token: string; expiresAt: number }
  files?: Map<string, string>
  respond?: (url: string, method: string) => { status: number; body: any } | 'network-error'
  /** true = Start in der Scriptable-App (Einrichtung/Menü) statt im Widget */
  inApp?: boolean
  /** Antworten der Dialoge in der App (Reihenfolge) */
  alertChoices?: number[]
  sheetChoices?: number[]
  fields?: string[]
}

const ROWS = {
  habits: [
    habit('a', 'Meditieren', 1, { color: 'violet' }),
    habit('b', 'Vitamine', 2, { color: 'lime' }),
    habit('w', 'Laufen', 3, { color: 'sky', schedule_type: 'times_per_week', schedule_config: { times: 2 } }),
  ],
  completions: [{ habit_id: 'a', date: '2026-11-19', value: 1, deleted_at: null }],
  pauses: [] as any[],
}

function defaultRespond(url: string, method: string) {
  if (url.includes('/auth/v1/token')) return { status: 200, body: { access_token: 'TOKEN-1', expires_in: 3600 } }
  if (url.includes('/rest/v1/habits')) return { status: 200, body: ROWS.habits }
  if (url.includes('/rest/v1/completions')) return { status: 200, body: ROWS.completions }
  if (url.includes('/rest/v1/pauses')) return { status: 200, body: ROWS.pauses }
  return { status: 404, body: { message: 'unbekannt ' + method } }
}

async function runScript(opts: Opts = {}) {
  const widgets: Node[] = []
  const presented: string[] = []
  const alertsShown: string[] = []
  const requests: Array<{ url: string; method?: string; headers?: Record<string, string> }> = []
  const keychain = new Map<string, string>()
  if (opts.creds !== false) {
    keychain.set('habit-widget:email', 'me@example.com')
    keychain.set('habit-widget:password', 'secret')
  }
  if (opts.token) keychain.set('habit-widget:token', JSON.stringify(opts.token))
  const files = opts.files ?? new Map<string, string>()
  const respond = opts.respond ?? defaultRespond

  class FakeRequest {
    url: string
    method = 'GET'
    headers: Record<string, string> = {}
    body?: string
    response?: { statusCode: number }
    constructor(url: string) {
      this.url = url
    }
    async loadJSON() {
      requests.push({ url: this.url, method: this.method, headers: this.headers })
      const r = respond(this.url, this.method)
      if (r === 'network-error') throw new Error('The Internet connection appears to be offline.')
      this.response = { statusCode: r.status }
      return r.body
    }
  }

  const env: Record<string, unknown> = {
    ListWidget: class extends Node {
      constructor() {
        super('widget')
      }
      async presentSmall() {
        presented.push('small')
      }
      async presentMedium() {
        presented.push('medium')
      }
    },
    Color: class {
      hex: string
      constructor(hex: string) {
        this.hex = hex
      }
      static dynamic(light: unknown, dark: unknown) {
        return { light, dark }
      }
    },
    Font: Object.fromEntries(['systemFont', 'mediumSystemFont', 'semiboldSystemFont', 'boldSystemFont'].map((n) => [n, (s: number) => `${n}:${s}`])),
    Size: class {
      w: number
      h: number
      constructor(w: number, h: number) {
        this.w = w
        this.h = h
      }
    },
    Script: { setWidget: (w: Node) => widgets.push(w), complete: () => {} },
    config: { runsInWidget: !opts.inApp, widgetFamily: opts.family ?? 'small' },
    Request: FakeRequest,
    Keychain: {
      contains: (k: string) => keychain.has(k),
      get: (k: string) => keychain.get(k),
      set: (k: string, v: string) => void keychain.set(k, v),
      remove: (k: string) => {
        if (!keychain.has(k)) throw new Error(`the key '${k}' does not exist in the keychain`)
        keychain.delete(k)
      },
    },
    FileManager: {
      local: () => ({
        documentsDirectory: () => '/docs',
        joinPath: (a: string, b: string) => `${a}/${b}`,
        fileExists: (p: string) => files.has(p),
        readString: (p: string) => files.get(p),
        writeString: (p: string, s: string) => void files.set(p, s),
        remove: (p: string) => void files.delete(p),
      }),
    },
    Alert: class {
      title = ''
      message = ''
      addTextField() {}
      addSecureTextField() {}
      addAction() {}
      addCancelAction() {}
      addDestructiveAction() {}
      textFieldValue(i: number) {
        return (opts.fields ?? [])[i] ?? ''
      }
      async presentAlert() {
        alertsShown.push(this.title)
        const c = (opts.alertChoices ?? []).shift()
        return c ?? 0
      }
      async presentSheet() {
        alertsShown.push(this.title)
        const c = (opts.sheetChoices ?? []).shift()
        return c ?? -1
      }
    },
  }

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  await new AsyncFunction(...Object.keys(env), script)(...Object.values(env))
  return { widgets, requests, keychain, files, presented, alertsShown }
}

const texts = (w: Node) => walk(w).filter((n) => n.kind === 'text').map((n) => n.text as string)

beforeEach(() => {
  // Donnerstag, 19. November 2026 (Wien)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-19T11:00:00+01:00'))
})
afterEach(() => vi.useRealTimers())

describe('Widget-Skript (Rauchtest mit Scriptable-Attrappe)', () => {
  it('Platzhalter sind ersetzt und das Skript enthält kein Passwort', () => {
    expect(script).not.toContain('__HT_')
    expect(script).toContain(CFG.supabaseUrl)
    expect(script).not.toMatch(/secret/i)
  })

  it('klein: Zahl, Quadrate je Gewohnheit, Fußzeile, Tipp öffnet die App', async () => {
    const { widgets, requests, keychain, files } = await runScript({ family: 'small' })
    expect(widgets).toHaveLength(1)
    const w = widgets[0]
    const t = texts(w)
    expect(t).toContain('Do, 19. Nov')
    expect(t).toContain('1') // erledigt
    expect(t).toContain('/2') // verpflichtend + erledigt (Laufen ist optional)
    expect(t).toContain('+ 1 optional')
    const squares = walk(w).filter((n) => n.size && n.size.w === 14 && n.size.h === 14)
    expect(squares).toHaveLength(3)
    expect(w.url).toBe(CFG.appUrl)
    // Anmeldung, Token zwischengespeichert, Daten zwischengespeichert
    expect(requests[0].url).toContain('/auth/v1/token')
    expect(requests.some((r) => r.url.includes('/rest/v1/habits') && r.headers?.Authorization === 'Bearer TOKEN-1' && r.headers?.apikey === CFG.anonKey)).toBe(true)
    expect(keychain.get('habit-widget:token')).toContain('TOKEN-1')
    expect([...files.keys()][0]).toContain('habit-widget-cache.json')
  })

  it('mittel: offene Gewohnheiten und Wochenzeile', async () => {
    const { widgets } = await runScript({ family: 'medium' })
    const t = texts(widgets[0])
    expect(t).toContain('Noch offen')
    expect(t).toContain('Vitamine')
    expect(t).not.toContain('Meditieren') // schon erledigt
    expect(t).toContain('Diese Woche: Laufen 0/2')
    const bars = walk(widgets[0]).filter((n) => n.size && n.size.h === 7)
    expect(bars).toHaveLength(3)
  })

  it('mittel: alles erledigt', async () => {
    const { widgets } = await runScript({
      family: 'medium',
      respond: (url, m) => (url.includes('/rest/v1/completions') ? { status: 200, body: [...ROWS.completions, { habit_id: 'b', date: '2026-11-19', value: 1, deleted_at: null }] } : defaultRespond(url, m)),
    })
    const t = texts(widgets[0])
    expect(t).toContain('Alles erledigt')
  })

  it('gültiger Token wird wiederverwendet (keine neue Anmeldung)', async () => {
    const { requests } = await runScript({ token: { token: 'ALT', expiresAt: Date.now() + 600_000 } })
    expect(requests.some((r) => r.url.includes('/auth/v1/token'))).toBe(false)
    expect(requests[0].headers?.Authorization).toBe('Bearer ALT')
  })

  it('abgelaufener Token führt zu neuer Anmeldung', async () => {
    const { requests } = await runScript({ token: { token: 'ALT', expiresAt: Date.now() - 1000 } })
    expect(requests[0].url).toContain('/auth/v1/token')
  })

  it('offline: zeigt die zwischengespeicherten Daten mit "offline"', async () => {
    const files = new Map<string, string>()
    await runScript({ family: 'small', files }) // füllt den Zwischenspeicher
    const { widgets } = await runScript({ family: 'small', files, respond: () => 'network-error' })
    const t = texts(widgets[0])
    expect(t).toContain('Do, 19. Nov · offline')
    expect(t).toContain('/2')
  })

  it('offline ohne Zwischenspeicher: Hinweis statt Absturz', async () => {
    const { widgets } = await runScript({ respond: () => 'network-error' })
    expect(texts(widgets[0])).toContain('Keine Daten')
  })

  it('falsches Passwort: Hinweis zur Anmeldung, kein Zwischenspeicher-Fallback', async () => {
    const files = new Map<string, string>()
    await runScript({ files })
    const { widgets } = await runScript({ files, respond: (url) => (url.includes('/auth/v1/token') ? { status: 400, body: { error_description: 'Invalid login credentials' } } : { status: 200, body: [] }) })
    expect(texts(widgets[0])).toContain('Anmeldung nötig')
  })

  it('Einrichtung in der App: Zugangsdaten speichern (ohne vorhandenen Token) und Vorschau zeigen', async () => {
    const { presented, keychain, alertsShown, requests } = await runScript({
      inApp: true,
      creds: false,
      fields: ['me@example.com', 'geheim'],
      alertChoices: [0], // "Speichern"
      sheetChoices: [0, 1, 4], // Vorschau klein, Vorschau mittel, Schließen
    })
    expect(keychain.get('habit-widget:email')).toBe('me@example.com')
    expect(keychain.get('habit-widget:password')).toBe('geheim')
    expect(alertsShown[0]).toBe('Habit Tracker anmelden')
    expect(presented).toEqual(['small', 'medium'])
    expect(requests.some((r) => r.url.includes('/auth/v1/token'))).toBe(true)
  })

  it('Zugangsdaten ändern, wenn schon ein Token existiert, und anschließend löschen', async () => {
    const { keychain, files } = await runScript({
      inApp: true,
      token: { token: 'ALT', expiresAt: Date.now() + 600_000 },
      fields: ['neu@example.com', 'neues-passwort'],
      alertChoices: [0, 0], // Speichern, dann OK-Hinweis nach dem Löschen
      sheetChoices: [2, 3], // Zugangsdaten ändern, Zugangsdaten löschen
    })
    expect(keychain.size).toBe(0)
    expect(files.size).toBe(0)
  })

  it('Einrichtung abbrechen schreibt nichts', async () => {
    const { keychain } = await runScript({ inApp: true, creds: false, fields: ['x@y.z', 'pw'], alertChoices: [1] })
    expect(keychain.size).toBe(0)
  })

  it('abgelaufene Anmeldung (401) entfernt den Token ohne Fehler', async () => {
    const { widgets, keychain } = await runScript({
      token: { token: 'ALT', expiresAt: Date.now() + 600_000 },
      respond: (url, m) => (url.includes('/rest/v1/') ? { status: 401, body: { message: 'JWT expired' } } : defaultRespond(url, m)),
    })
    expect(keychain.has('habit-widget:token')).toBe(false)
    expect(texts(widgets[0])).toContain('Anmeldung nötig')
  })

  it('nicht eingerichtet: Hinweis, kein Netzwerkzugriff', async () => {
    const { widgets, requests } = await runScript({ creds: false })
    expect(texts(widgets[0]).join(' ')).toContain('Öffne das Skript in Scriptable')
    expect(requests).toHaveLength(0)
  })

  it('Wochenziel wird verpflichtend, wenn es heute sein muss (Sonntag)', async () => {
    vi.setSystemTime(new Date('2026-11-22T11:00:00+01:00')) // Sonntag: Laufen 0/2, nur 1 Tag übrig
    const { widgets } = await runScript({ family: 'medium', respond: (url, m) => (url.includes('/rest/v1/completions') ? { status: 200, body: [] } : defaultRespond(url, m)) })
    const t = texts(widgets[0])
    expect(t).toContain('Laufen')
    expect(t.some((x) => x.startsWith('Diese Woche'))).toBe(false)
  })
})
