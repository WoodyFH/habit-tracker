// Gemeinsame Typen. Spiegeln das Supabase-Schema (supabase/schema.sql).

/** Lokaler Kalendertag "YYYY-MM-DD" (Zeitzone Europe/Vienna). Kein UTC-Zeitstempel! */
export type DateStr = string

export type HabitType = 'build' | 'quit'
/** "measurement" ist im Schema vorgesehen, wird aber noch nicht in der UI angeboten. */
export type TrackingMode = 'yes_no' | 'counter' | 'measurement'
export type ScheduleType = 'daily' | 'weekdays' | 'times_per_week' | 'times_per_month' | 'every_n_days'

export interface ScheduleConfig {
  /** 1 = Montag … 7 = Sonntag (für "weekdays") */
  weekdays?: number[]
  /** Anzahl pro Woche / pro Monat (für "times_per_week" / "times_per_month") */
  times?: number
  /** Intervall in Tagen (für "every_n_days") */
  interval?: number
}

/** Felder, die jede synchronisierte Zeile hat. */
export interface SyncFields {
  id: string
  user_id: string
  updated_at: string // ISO-Zeitstempel (UTC)
  deleted_at: string | null
}

export interface Habit extends SyncFields {
  name: string
  description: string | null
  icon: string
  color: string
  type: HabitType
  tracking_mode: TrackingMode
  target_value: number | null
  unit: string | null
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  start_date: DateStr
  end_date: DateStr | null
  sort_order: number
  archived: boolean
  created_at: string
}

export interface Completion extends SyncFields {
  habit_id: string
  date: DateStr
  value: number
  note: string | null
}

export interface Category extends SyncFields {
  name: string
  sort_order: number
  created_at: string
}

export interface HabitCategory extends SyncFields {
  habit_id: string
  category_id: string
}

export interface Pause extends SyncFields {
  habit_id: string
  from_date: DateStr
  to_date: DateStr
}

/** Lokal gespeicherte Zeile: zusätzlich ein Dirty-Flag (1 = noch nicht hochgeladen). */
export type Local<T> = T & { _dirty: 0 | 1 }

/** Die Teilmenge einer Gewohnheit, die Fälligkeits- und Serienlogik braucht. */
export type HabitLogic = Pick<
  Habit,
  'type' | 'tracking_mode' | 'target_value' | 'schedule_type' | 'schedule_config' | 'start_date' | 'end_date'
>

export interface DateRange {
  from: DateStr
  to: DateStr
}
