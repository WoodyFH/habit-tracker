// Habit-Tracker-Widget für die Scriptable-App (iPhone).
// Dieses Skript wird mit `npm run widget` gebaut und über Einstellungen → "Widget-Skript kopieren" in die App geholt.
// Es enthält nur öffentliche Werte (Projekt-URL, anon key). Das Passwort liegt im iOS-Schlüsselbund, nie im Skript.
import { todayStr } from '../../src/lib/dates'
import { computeWidgetModel, type RawData, type WidgetModel, type WidgetSegment } from './model'

// Platzhalter – werden beim Kopieren in der App ersetzt
const CONFIG = {
  supabaseUrl: '__HT_SUPABASE_URL__',
  anonKey: '__HT_ANON_KEY__',
  appUrl: '__HT_APP_URL__',
}

const KEY = {
  email: 'habit-widget:email',
  password: 'habit-widget:password',
  token: 'habit-widget:token',
}
const CACHE_FILE = 'habit-widget-cache.json'
const REFRESH_MINUTES = 15
const LOOKBACK_DAYS = 200

// ---------------------------------------------------------------------------
// Farben (Hell/Dunkel folgt dem System)
// ---------------------------------------------------------------------------

const LIGHT = { card: '#ffffff', ink: '#111827', muted: '#6b7280', line: '#e6e8ec' }
const DARK = { card: '#1a1d24', ink: '#f3f4f6', muted: '#9aa1ad', line: '#2b2f39' }
const dyn = (l: string, d: string) => Color.dynamic(new Color(l), new Color(d))

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * t + ((pb >> shift) & 255) * (1 - t))
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')
}

const C = {
  card: () => dyn(LIGHT.card, DARK.card),
  ink: () => dyn(LIGHT.ink, DARK.ink),
  muted: () => dyn(LIGHT.muted, DARK.muted),
  line: () => dyn(LIGHT.line, DARK.line),
}

/** Segmente wie in der App: erledigt = Farbe · verpflichtend offen = weiß mit Rahmen · optional = ganz hell */
function styleSegment(el: any, s: WidgetSegment) {
  if (s.kind === 'done') {
    el.backgroundColor = new Color(s.hex)
  } else if (s.kind === 'required') {
    el.backgroundColor = C.card()
    el.borderWidth = 1.5
    el.borderColor = dyn(mixHex(s.hex, LIGHT.card, 0.55), mixHex(s.hex, DARK.card, 0.55))
  } else {
    el.backgroundColor = dyn(mixHex(s.hex, LIGHT.card, 0.2), mixHex(s.hex, DARK.card, 0.2))
  }
}

// ---------------------------------------------------------------------------
// Anmeldung und Daten
// ---------------------------------------------------------------------------

class AuthError extends Error {}

/** Keychain.remove wirft einen Fehler, wenn der Schlüssel nicht existiert – deshalb vorher prüfen. */
function removeKey(key: string) {
  if (Keychain.contains(key)) Keychain.remove(key)
}

/** Scriptables eigene Request-Klasse (heißt wie der Browser-Typ, deshalb hier als any). */
const makeRequest = (url: string): any => new (Request as any)(url)

function api(path: string, token?: string, extra?: Record<string, string>) {
  const req = makeRequest(CONFIG.supabaseUrl + path)
  req.headers = { apikey: CONFIG.anonKey, Authorization: 'Bearer ' + (token ?? CONFIG.anonKey), ...(extra ?? {}) }
  return req
}

async function login(email: string, password: string): Promise<string> {
  const req = makeRequest(CONFIG.supabaseUrl + '/auth/v1/token?grant_type=password')
  req.method = 'POST'
  req.headers = { apikey: CONFIG.anonKey, 'Content-Type': 'application/json' }
  req.body = JSON.stringify({ email, password })
  const json = await req.loadJSON()
  const status = req.response?.statusCode
  if (status !== 200 || !json?.access_token) {
    if (status === 400 || status === 401 || status === 422) throw new AuthError('E-Mail oder Passwort stimmt nicht.')
    throw new Error((json && (json.error_description || json.msg || json.message)) || 'Anmeldung fehlgeschlagen')
  }
  const expiresAt = Date.now() + ((json.expires_in ?? 3600) - 120) * 1000
  Keychain.set(KEY.token, JSON.stringify({ token: json.access_token, expiresAt }))
  return json.access_token as string
}

async function getToken(): Promise<string> {
  if (Keychain.contains(KEY.token)) {
    try {
      const t = JSON.parse(Keychain.get(KEY.token))
      if (t.token && t.expiresAt > Date.now()) return t.token as string
    } catch {
      /* neu anmelden */
    }
  }
  if (!Keychain.contains(KEY.email) || !Keychain.contains(KEY.password)) throw new AuthError('Nicht eingerichtet.')
  return login(Keychain.get(KEY.email), Keychain.get(KEY.password))
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

async function fetchRows(path: string, token: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const req = api(path, token, { 'Range-Unit': 'items', Range: `${from}-${from + 999}` })
    const rows = await req.loadJSON()
    const status = req.response?.statusCode
    if (status === 401) {
      removeKey(KEY.token)
      throw new AuthError('Anmeldung abgelaufen.')
    }
    if (status !== 200 && status !== 206) throw new Error((rows && (rows.message || rows.error)) || 'Daten konnten nicht geladen werden (' + status + ')')
    out.push(...rows)
    if (!Array.isArray(rows) || rows.length < 1000) break
  }
  return out
}

async function fetchAll(): Promise<RawData> {
  const token = await getToken()
  const since = addDaysIso(todayStr(), -LOOKBACK_DAYS)
  const [habits, completions, pauses] = await Promise.all([
    fetchRows('/rest/v1/habits?select=*&deleted_at=is.null&archived=eq.false&order=sort_order.asc', token),
    fetchRows(`/rest/v1/completions?select=habit_id,date,value,deleted_at&deleted_at=is.null&date=gte.${since}&order=date.asc`, token),
    fetchRows(`/rest/v1/pauses?select=habit_id,from_date,to_date,deleted_at&deleted_at=is.null&to_date=gte.${since}`, token),
  ])
  return { habits, completions, pauses }
}

// ---------------------------------------------------------------------------
// Zwischenspeicher (damit das Widget auch offline etwas anzeigt)
// ---------------------------------------------------------------------------

function cachePath(): string {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE)
}
function saveCache(raw: RawData) {
  try {
    FileManager.local().writeString(cachePath(), JSON.stringify({ raw, savedAt: Date.now() }))
  } catch {
    /* egal */
  }
}
function loadCache(): RawData | null {
  try {
    const fm = FileManager.local()
    const p = cachePath()
    if (!fm.fileExists(p)) return null
    return JSON.parse(fm.readString(p)).raw as RawData
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------

function baseWidget(): any {
  const w = new ListWidget()
  w.backgroundColor = C.card()
  w.setPadding(14, 14, 14, 14)
  w.url = CONFIG.appUrl
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)
  return w
}

function addCount(parent: any, m: WidgetModel) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.bottomAlignContent()
  const n = row.addText(m.total === 0 && m.segments.length === 0 ? '–' : String(m.done))
  n.font = Font.semiboldSystemFont(34)
  n.textColor = C.ink()
  if (m.total > 0 || m.segments.length > 0) {
    const t = row.addText('/' + m.total)
    t.font = Font.mediumSystemFont(18)
    t.textColor = C.muted()
  }
}

function footerText(m: WidgetModel): string {
  if (m.segments.length === 0) return 'Heute nichts fällig'
  if (m.total > 0 && m.done === m.total) return m.optionalOpen > 0 ? `Alles erledigt · + ${m.optionalOpen} optional` : 'Alles erledigt'
  if (m.total === 0) return `${m.optionalOpen} optional`
  return m.optionalOpen > 0 ? `+ ${m.optionalOpen} optional` : `${m.total - m.done} offen`
}

function addSmallText(parent: any, text: string, color: any = C.muted(), size = 11) {
  const t = parent.addText(text)
  t.font = Font.mediumSystemFont(size)
  t.textColor = color
  t.lineLimit = 1
  t.minimumScaleFactor = 0.8
  return t
}

/** Klein: ein abgerundetes Quadrat je Gewohnheit (wie die Felder in der App). */
function buildSmall(m: WidgetModel, offline: boolean): any {
  const w = baseWidget()
  addSmallText(w, m.dateLabel + (offline ? ' · offline' : ''))
  w.addSpacer()
  addCount(w, m)
  w.addSpacer(8)

  const perRow = 6
  const size = 14
  const gap = 4
  const maxSquares = perRow * 2
  const shown = m.segments.slice(0, maxSquares)
  for (let i = 0; i < shown.length; i += perRow) {
    if (i > 0) w.addSpacer(gap)
    const row = w.addStack()
    row.layoutHorizontally()
    row.spacing = gap
    for (const s of shown.slice(i, i + perRow)) {
      const sq = row.addStack()
      sq.size = new Size(size, size)
      sq.cornerRadius = 4.5
      styleSegment(sq, s)
    }
  }
  w.addSpacer(8)
  const extra = m.segments.length - shown.length
  addSmallText(w, footerText(m) + (extra > 0 ? ` · +${extra}` : ''))
  return w
}

/** Mittel: links Zahl und Segmentbalken, rechts die offenen Gewohnheiten. */
function buildMedium(m: WidgetModel, offline: boolean): any {
  const w = baseWidget()
  const row = w.addStack()
  row.layoutHorizontally()

  // linke Spalte
  const leftW = 118
  const left = row.addStack()
  left.layoutVertically()
  left.size = new Size(leftW, 0)
  addSmallText(left, m.dateLabel + (offline ? ' · offline' : ''))
  left.addSpacer()
  addCount(left, m)
  left.addSpacer(8)
  if (m.segments.length > 0) {
    const bars = left.addStack()
    bars.layoutHorizontally()
    const gap = 3
    bars.spacing = gap
    const bw = Math.max(4, Math.floor((leftW - gap * (m.segments.length - 1)) / m.segments.length))
    for (const s of m.segments) {
      const b = bars.addStack()
      b.size = new Size(bw, 7)
      b.cornerRadius = 3.5
      styleSegment(b, s)
    }
  }
  left.addSpacer(8)
  addSmallText(left, footerText(m))

  row.addSpacer(12)
  const divider = row.addStack()
  divider.size = new Size(0.5, 104)
  divider.backgroundColor = C.line()
  row.addSpacer(12)

  // rechte Spalte
  const right = row.addStack()
  right.layoutVertically()
  const open = m.openRequired
  const maxRows = m.weekLine ? 3 : 4
  if (open.length === 0) {
    addSmallText(right, m.segments.length === 0 ? 'Heute' : 'Noch offen')
    right.addSpacer(8)
    const t = right.addText(m.segments.length === 0 ? 'Nichts fällig' : 'Alles erledigt')
    t.font = Font.semiboldSystemFont(15)
    t.textColor = C.ink()
    t.lineLimit = 1
  } else {
    addSmallText(right, 'Noch offen')
    right.addSpacer(7)
    open.slice(0, maxRows).forEach((s, i) => {
      if (i > 0) right.addSpacer(6)
      const line = right.addStack()
      line.layoutHorizontally()
      line.centerAlignContent()
      const dot = line.addStack()
      dot.size = new Size(8, 8)
      dot.cornerRadius = 3
      dot.backgroundColor = new Color(s.hex)
      line.addSpacer(8)
      const name = line.addText(s.name)
      name.font = Font.mediumSystemFont(14)
      name.textColor = C.ink()
      name.lineLimit = 1
      name.minimumScaleFactor = 0.8
    })
    if (open.length > maxRows) {
      right.addSpacer(6)
      addSmallText(right, `+ ${open.length - maxRows} weitere`)
    }
  }
  right.addSpacer()
  if (m.weekLine) addSmallText(right, m.weekLine)
  return w
}

function messageWidget(title: string, text: string): any {
  const w = baseWidget()
  const t = w.addText(title)
  t.font = Font.semiboldSystemFont(15)
  t.textColor = C.ink()
  w.addSpacer(6)
  const d = w.addText(text)
  d.font = Font.systemFont(12)
  d.textColor = C.muted()
  return w
}

// ---------------------------------------------------------------------------
// Einrichtung (nur beim Start in der Scriptable-App, nie im Widget)
// ---------------------------------------------------------------------------

async function askCredentials(): Promise<boolean> {
  const a = new Alert()
  a.title = 'Habit Tracker anmelden'
  a.message = 'Gib die Zugangsdaten deines Supabase-Nutzers ein. Das Passwort wird nur im iOS-Schlüsselbund gespeichert.'
  a.addTextField('E-Mail', Keychain.contains(KEY.email) ? Keychain.get(KEY.email) : '')
  a.addSecureTextField('Passwort', '')
  a.addAction('Speichern')
  a.addCancelAction('Abbrechen')
  const choice = await a.presentAlert()
  if (choice !== 0) return false
  const email = String(a.textFieldValue(0)).trim()
  const password = String(a.textFieldValue(1))
  if (!email || !password) return false
  Keychain.set(KEY.email, email)
  Keychain.set(KEY.password, password)
  removeKey(KEY.token)
  return true
}

function clearCredentials() {
  for (const k of Object.values(KEY)) removeKey(k)
  try {
    const fm = FileManager.local()
    if (fm.fileExists(cachePath())) fm.remove(cachePath())
  } catch {
    /* egal */
  }
}

async function loadModel(): Promise<{ model: WidgetModel | null; offline: boolean; error: string | null; authProblem: boolean }> {
  try {
    const raw = await fetchAll()
    saveCache(raw)
    return { model: computeWidgetModel(raw, todayStr()), offline: false, error: null, authProblem: false }
  } catch (e: any) {
    const auth = e instanceof AuthError
    const cached = auth ? null : loadCache()
    if (cached) return { model: computeWidgetModel(cached, todayStr()), offline: true, error: null, authProblem: false }
    return { model: null, offline: false, error: String(e?.message ?? e), authProblem: auth }
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function run() {
  const inWidget = !!config.runsInWidget

  if (inWidget) {
    if (!Keychain.contains(KEY.email) || !Keychain.contains(KEY.password)) {
      Script.setWidget(messageWidget('Habit Tracker', 'Öffne das Skript in Scriptable, um dich anzumelden.'))
      return
    }
    const { model, offline, error, authProblem } = await loadModel()
    const family = config.widgetFamily
    if (!model) {
      Script.setWidget(messageWidget(authProblem ? 'Anmeldung nötig' : 'Keine Daten', authProblem ? 'Öffne das Skript in Scriptable und gib die Zugangsdaten neu ein.' : (error ?? 'Bitte später erneut versuchen.')))
      return
    }
    Script.setWidget(family === 'small' ? buildSmall(model, offline) : buildMedium(model, offline))
    return
  }

  // In der Scriptable-App: Einrichtung und Vorschau
  if (!Keychain.contains(KEY.email) || !Keychain.contains(KEY.password)) {
    if (!(await askCredentials())) return
  }
  for (;;) {
    const menu = new Alert()
    menu.title = 'Habit Tracker Widget'
    menu.message = 'Vorschau ansehen oder Zugangsdaten verwalten. Das Widget fügst du danach auf dem Home-Bildschirm hinzu.'
    menu.addAction('Vorschau klein')
    menu.addAction('Vorschau mittel')
    menu.addAction('Zugangsdaten ändern')
    menu.addDestructiveAction('Zugangsdaten löschen')
    menu.addCancelAction('Schließen')
    const choice = await menu.presentSheet()
    if (choice === 0 || choice === 1) {
      const { model, offline, error, authProblem } = await loadModel()
      if (!model) {
        const a = new Alert()
        a.title = authProblem ? 'Anmeldung fehlgeschlagen' : 'Keine Daten'
        a.message = error ?? 'Unbekannter Fehler'
        a.addAction('OK')
        await a.presentAlert()
        continue
      }
      const w = choice === 0 ? buildSmall(model, offline) : buildMedium(model, offline)
      if (choice === 0) await w.presentSmall()
      else await w.presentMedium()
    } else if (choice === 2) {
      await askCredentials()
    } else if (choice === 3) {
      clearCredentials()
      const a = new Alert()
      a.title = 'Gelöscht'
      a.message = 'Zugangsdaten und Zwischenspeicher wurden entfernt.'
      a.addAction('OK')
      await a.presentAlert()
      return
    } else {
      return
    }
  }
}
