-- =====================================================================
-- Habit Tracker – Supabase-Schema (Postgres) inkl. Row Level Security
-- Im Supabase Dashboard unter "SQL Editor" einfügen und ausführen.
-- Das Skript ist idempotent (kann mehrfach ausgeführt werden).
--
-- Konzepte
--  * Jede Zeile gehört genau einem Nutzer (user_id = auth.uid()).
--  * Löschen ist immer "Soft Delete" (deleted_at), damit der Sync zuverlässig ist.
--  * Konfliktlösung "last write wins" über updated_at (vom Client gesetzt).
--    Ein Trigger verwirft Schreibvorgänge, die älter sind als der gespeicherte Stand.
--  * synced_at wird vom SERVER gesetzt und dient als Sync-Cursor. Dadurch gehen
--    auch Änderungen nicht verloren, die ein Gerät lange offline gesammelt hat.
--  * Datumswerte (date, start_date, ...) sind lokale Kalendertage (Typ DATE,
--    "YYYY-MM-DD", Europe/Vienna) – keine UTC-Zeitstempel.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------

create table if not exists public.habits (
  id             uuid primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 200),
  description    text,
  icon           text not null default 'check',
  color          text not null default 'indigo',
  -- build = Aufbauen, quit = Abgewöhnen
  type           text not null default 'build' check (type in ('build', 'quit')),
  -- yes_no | counter | measurement ("Messwert" ist schon vorgesehen, wird aber noch nicht in der App gebaut)
  tracking_mode  text not null default 'yes_no' check (tracking_mode in ('yes_no', 'counter', 'measurement')),
  target_value   numeric,
  unit           text,
  -- daily | weekdays | times_per_week | times_per_month | every_n_days
  schedule_type  text not null default 'daily'
                 check (schedule_type in ('daily', 'weekdays', 'times_per_week', 'times_per_month', 'every_n_days')),
  -- z.B. {"weekdays":[1,3,5]} | {"times":3} | {"interval":2}   (1 = Montag … 7 = Sonntag)
  schedule_config jsonb not null default '{}'::jsonb,
  start_date     date not null,
  end_date       date,
  sort_order     double precision not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  synced_at      timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  sort_order  double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now()
);

create table if not exists public.habit_categories (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id     uuid not null references public.habits(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now(),
  unique (habit_id, category_id)
);

-- value ist bewusst "numeric": Ja/Nein = 1, Zähler = Anzahl, später Messwert = freier Zahlenwert.
-- Für den Modus "Messwert" ist deshalb KEINE Datenmigration nötig.
create table if not exists public.completions (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  date        date not null,
  value       numeric not null default 1,
  note        text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists public.pauses (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  from_date   date not null,
  to_date     date not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now(),
  check (to_date >= from_date)
);

-- Indizes (Sync-Cursor und Zugriffe pro Gewohnheit)
create index if not exists habits_sync_idx            on public.habits (user_id, synced_at);
create index if not exists categories_sync_idx        on public.categories (user_id, synced_at);
create index if not exists habit_categories_sync_idx  on public.habit_categories (user_id, synced_at);
create index if not exists completions_sync_idx       on public.completions (user_id, synced_at);
create index if not exists completions_habit_date_idx on public.completions (habit_id, date);
create index if not exists pauses_sync_idx            on public.pauses (user_id, synced_at);

-- ---------------------------------------------------------------------
-- Trigger: "last write wins" + Server-Zeitstempel für den Sync-Cursor
-- ---------------------------------------------------------------------

create or replace function public.sync_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    -- Älterer Stand als der gespeicherte? Dann Update stillschweigend verwerfen.
    if new.updated_at < old.updated_at then
      return null;
    end if;
    -- user_id darf nie geändert werden.
    new.user_id := old.user_id;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['habits', 'categories', 'habit_categories', 'completions', 'pauses'] loop
    execute format('drop trigger if exists sync_guard on public.%I', t);
    execute format(
      'create trigger sync_guard before insert or update on public.%I
         for each row execute function public.sync_guard()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security: nur die eigene user_id hat Zugriff
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['habits', 'categories', 'habit_categories', 'completions', 'pauses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);

    execute format(
      'create policy "own rows select" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows update" on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Anonyme Nutzer (nur anon key, ohne Login) bekommen gar nichts.
revoke all on public.habits, public.categories, public.habit_categories,
              public.completions, public.pauses from anon;
grant select, insert, update, delete on public.habits, public.categories, public.habit_categories,
              public.completions, public.pauses to authenticated;

-- ---------------------------------------------------------------------
-- OPTIONAL (zusätzliche Absicherung): Nur genau EINEN Nutzer zulassen.
-- 1. Deine User-ID findest du unter Authentication → Users.
-- 2. Die Zeilen unten einkommentieren und die UUID eintragen.
--    (Die Registrierung ist ohnehin im Projekt deaktiviert.)
-- ---------------------------------------------------------------------
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['habits', 'categories', 'habit_categories', 'completions', 'pauses'] loop
--     execute format('drop policy if exists "only owner" on public.%I', t);
--     execute format(
--       'create policy "only owner" on public.%I as restrictive for all to authenticated
--          using (auth.uid() = ''00000000-0000-0000-0000-000000000000''::uuid)
--          with check (auth.uid() = ''00000000-0000-0000-0000-000000000000''::uuid)', t);
--   end loop;
-- end $$;
