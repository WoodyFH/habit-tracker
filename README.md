# Habit Tracker

Privater Habit Tracker als Progressive Web App (PWA). Läuft auf iPhone (Hauptgerät), Android und Windows,
funktioniert offline und synchronisiert sich zwischen deinen Geräten. Die Oberfläche ist komplett auf Deutsch.

**Technik:** Vite · React · TypeScript · Tailwind · Dexie (IndexedDB) · Supabase (Postgres + Auth) · Vitest · GitHub Pages

---

## Anleitung: Was du tun musst

### Teil A – Supabase (Backend & Login)

1. **Projekt anlegen.** Auf [supabase.com](https://supabase.com) einloggen → **New project**. Name frei wählbar,
   Region z. B. *Central EU (Frankfurt)*, ein Datenbank-Passwort vergeben (gut aufbewahren; die App braucht es nicht).
2. **Datenbank-Schema einspielen.** Im Projekt links **SQL Editor** → **New query** → den gesamten Inhalt von
   [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**. Erwartung: „Success“.
   Danach unter **Table Editor** siehst du fünf Tabellen (`habits`, `categories`, `habit_categories`, `completions`, `pauses`),
   jeweils mit dem Hinweis „RLS enabled“. Das Skript kann gefahrlos mehrfach ausgeführt werden.
3. **Registrierung deaktivieren.** **Authentication** → **Sign In / Providers** (je nach Dashboard-Version auch
   „Providers“ bzw. „Settings“) → Schalter **Allow new users to sign up** (Neue Nutzer zulassen) **ausschalten** → **Save**.
   Der E-Mail-Provider selbst bleibt aktiviert, sonst funktioniert der Login nicht.
4. **Deinen Nutzer anlegen.** **Authentication** → **Users** → **Add user** → **Create new user**:
   E-Mail und ein starkes Passwort eintragen, **Auto Confirm User** anhaken → **Create user**.
   Mit diesen Daten meldest du dich später in der App an.
5. *(Optional, zusätzliche Absicherung)* Kopiere in **Authentication → Users** deine **User UID**. Im Ende von
   `supabase/schema.sql` steht ein auskommentierter Block „only owner“. Trage dort deine UID ein, entferne die
   Kommentarzeichen und führe nur diesen Block im SQL Editor aus. Dann hat selbst bei einer Fehlkonfiguration kein
   anderer Nutzer Zugriff.
6. **URL und anon key finden.** **Project Settings** (Zahnrad) → **API** (neuere Dashboards: Button **Connect** bzw.
   **API Keys**):
   - **Project URL**, z. B. `https://abcdxyz.supabase.co`
   - **anon public** Key (bei neueren Projekten heißt er **Publishable key**, `sb_publishable_…`)
   - ⚠️ **Niemals** den **service_role** / **secret** Key verwenden oder irgendwo eintragen.
7. **Lokal ausprobieren (optional).** `.env.example` nach `.env.local` kopieren, beide Werte eintragen,
   dann `npm install` und `npm run dev` (Adresse: http://localhost:5173).

### Teil B – GitHub (Hosting)

8. **Repository anlegen.** Auf GitHub **New repository** (Name z. B. `habit-tracker`, **Public**). Dann im Projektordner:

   ```powershell
   git init -b main
   git add .
   git commit -m "Habit Tracker"
   git remote add origin https://github.com/DEIN-NAME/habit-tracker.git
   git push -u origin main
   ```

   `.env.local` ist per `.gitignore` ausgeschlossen. Im Repo steht kein Schlüssel.
9. **Secrets setzen.** Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name `VITE_SUPABASE_URL` → deine Project URL
   - Name `VITE_SUPABASE_ANON_KEY` → dein anon public Key
10. **GitHub Pages aktivieren.** Repository → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.
11. **Deployment starten.** Der erste `git push` auf `main` startet den Workflow bereits (Reiter **Actions**; sonst dort
    **Deploy auf GitHub Pages → Run workflow**). Nach ca. 1–2 Minuten ist die App unter
    `https://DEIN-NAME.github.io/habit-tracker/` erreichbar.
    - Heißt dein Repo `DEIN-NAME.github.io` (User-Seite), lege unter **Settings → Secrets and variables → Actions → Variables**
      eine Variable `VITE_BASE` mit dem Wert `/` an.
    - Der Workflow führt vor dem Build die Unit-Tests aus; schlagen sie fehl, wird nicht veröffentlicht.

### Teil C – App installieren

12. **iPhone (Safari!).** Die Adresse in **Safari** öffnen (nicht in Chrome) → **Teilen**-Symbol (Quadrat mit Pfeil) →
    **Zum Home-Bildschirm** → **Hinzufügen**. Die App vom Home-Bildschirm starten und **einmal online anmelden**.
    Danach funktioniert sie auch ohne Netz. Hinweis: Die Home-Bildschirm-App hat auf iOS einen eigenen Speicher; melde
    dich dort separat an (nicht in Safari).
13. **Android (Chrome).** Adresse öffnen → Menü **⋮** → **App installieren** (oder **Zum Startbildschirm hinzufügen**) → Anmelden.
14. **Windows (Edge oder Chrome).** Adresse öffnen → in der Adressleiste auf das **Installieren**-Symbol klicken
    (Edge: **⋯ → Apps → Diese Website als App installieren**) → Anmelden.

---

## So funktioniert die App

- **Ansichten:** Karten (Abhaken-Button + Heatmap), Wochenliste (5–7 Tage, rückwirkend umschaltbar, blätterbar),
  Tabelle (Tage oder Wochen, horizontal scrollbar). Tippen schaltet einen Tag um, **langes Drücken** öffnet Wert und Notiz.
- **Oben:** Einstellungen, Filter (Kategorien, nur heute fällige, archivierte), Statistik, „+“. Darunter Kategorie-Chips.
- **Reihenfolge ändern:** Filter oder Einstellungen → „Reihenfolge ändern“ → am Griff ziehen.
- **Keine Erinnerungen / Push-Nachrichten** – bewusst nicht enthalten.

### Wiederholungsmodelle und Serien

| Modell | Fällig | Serie zählt in |
|---|---|---|
| Jeden Tag | täglich | Tagen |
| Bestimmte Wochentage | an den gewählten Tagen; andere Tage sind neutral | Tagen |
| X-mal pro Woche | beliebige Tage, Woche = Montag–Sonntag; „2 von 3 diese Woche“ | Wochen |
| X-mal pro Monat | beliebige Tage im Kalendermonat | Monaten |
| Alle N Tage | N Tage nach der letzten Erledigung (gleitend); überfällig bleibt fällig | Tagen |

Regeln, die ich festgelegt habe (Standardentscheidungen):

- **Neutral:** Tage, die laut Plan nicht dran sind, vor dem Start / nach dem Ende oder in einer Pause sind gestrichelt dargestellt,
  zählen **nie** als verpasst und lassen Serien nicht reißen.
- **Heute** bricht eine Serie nie ab, solange du den Tag noch erledigen kannst.
- **Wochen-/Monatsziele:** Der laufende, noch nicht erreichte Zeitraum bricht die Serie nicht. Pausen reduzieren das Ziel
  (z. B. 3× pro Woche, aber nur 2 Tage nicht pausiert → Ziel 2). Ein komplett pausierter Zeitraum wird übersprungen.
- **Alle N Tage:** Jede Erledigung innerhalb von N (nicht pausierten) Tagen nach der vorigen verlängert die Serie; eine
  vorzeitige Erledigung ist erlaubt.
- **Abgewöhnen:** Jeder Tag gilt als geschafft, bis du einen **Rückfall** einträgst (Eintrag = Rückfall). Heute zählt mit.
  Wiederholung ist hier immer „täglich“, Erfassung immer Ja/Nein.
- **Zähler:** Ein Tag gilt als erledigt, wenn der Wert das Tagesziel erreicht; darunter ist er „teilweise“.
- **Datumswerte** sind lokale Kalendertage (`YYYY-MM-DD`, Europe/Vienna), keine UTC-Zeitstempel. Wochen beginnen am Montag.
- **Erfolgsquote:** Anteil erreichter fälliger Tage (bzw. Wochen/Monate/Intervalle) – heute zählt nur, wenn schon erledigt.

Die gesamte Logik steckt in reinen, getesteten Funktionen: `src/lib/dates.ts`, `src/lib/schedule.ts`, `src/lib/streaks.ts`.

### Offline & Sync

- Jede Änderung wird **sofort lokal** gespeichert (IndexedDB) und im Hintergrund hochgeladen. Offline arbeitest du normal weiter.
- Sync bei App-Start, nach Änderungen, beim Zurückkehren in die App, bei Netz-Rückkehr und jede Minute.
- **Last write wins** über `updated_at`; zusätzlich verwirft ein Datenbank-Trigger veraltete Schreibvorgänge.
  Löschen ist immer ein **Soft Delete** (`deleted_at`).
- Einträge pro Tag haben eine **deterministische ID** (aus Gewohnheit + Datum). Legen zwei Geräte offline denselben Tag an,
  entsteht dadurch nie ein Konflikt.
- Der Sync-Status steht dezent unter dem Titel (offline / synchronisiert / Fehler, ggf. „n offen“).
- **Abmelden** entfernt die lokalen Daten vom Gerät (der Server behält alles). Gibt es noch nicht synchronisierte Änderungen,
  wirst du gewarnt.
- Ohne Supabase-Konfiguration startet die App im **Nur-lokal-Modus** (Hinweis in den Einstellungen). Meldest du dich später an,
  werden diese Daten deinem Konto zugeordnet und hochgeladen.

### Export / Import

Einstellungen → **Export als JSON** (vollständiges Backup), **Export als CSV** (Semikolon, für Excel) und **Import aus JSON**.
Der Import fügt hinzu bzw. überschreibt Einträge mit gleicher ID und löscht nichts.

### Messwert-Modus (vorbereitet, noch nicht gebaut)

`tracking_mode` erlaubt in der Datenbank bereits `measurement`, und `completions.value` ist ein freier Zahlenwert.
Der Modus kann später ohne Migration der bestehenden Daten ergänzt werden.

---

## Sicherheit (öffentliches Repo)

- Im Frontend stehen nur **Projekt-URL** und **anon key** (über `VITE_…`-Variablen, lokal `.env.local`, im Build über GitHub Secrets).
  Der anon key ist öffentlich vorgesehen. Geschützt sind die Daten durch **Row Level Security** (nur `user_id = auth.uid()`)
  und das **deaktivierte Registrierungsformular**.
- Es gibt **keinen** service_role Key und keine persönlichen Daten im Repo. `.env*` ist ausgeschlossen, `.env.example` enthält nur Platzhalter.
- Anonyme Zugriffe (nur anon key, ohne Login) liefern nichts.

## Entwicklung

```powershell
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests (Vitest)
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen (inkl. Service Worker)
npm run icons      # PNG-Icons aus dem SVG neu erzeugen
```

Struktur: `src/lib` (Logik, Datenbank, Sync, Export), `src/components` (Sheets, Karten, Bausteine),
`src/views` (die drei Ansichten), `supabase/schema.sql`, `.github/workflows/deploy.yml`.

## Bekannte Einschränkungen

- Die Statusleiste auf dem iPhone nutzt den Stil „default“ (hell/dunkel automatisch). Das Verhalten auf echten Geräten
  (Safe-Area, Statusleiste, Installation) wurde nur emuliert, nicht auf einem iPhone geprüft.
- Wenn sich zwei Geräte exakt gleichzeitig widersprechen, gewinnt die Änderung mit dem neueren `updated_at` (Geräteuhren sollten stimmen).
- `npm audit` meldet Hinweise in Build-Werkzeugen (workbox, Entwicklungsabhängigkeiten); sie landen nicht in der ausgelieferten App.
