// Supabase-Client. Im Frontend stehen NUR die Projekt-URL und der öffentliche anon key
// (aus Umgebungsvariablen). Niemals einen service_role Key verwenden!
import { createClient } from '@supabase/supabase-js'
import { cleanKey, isSecretKey, normalizeSupabaseUrl } from './supabaseConfig'

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const rawKey = cleanKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
const keyIsSecret = isSecretKey(rawKey ?? undefined)
if (keyIsSecret) {
  // Sicherheitsnetz: Ein service_role-Key darf nie im Browser landen.
  console.error('VITE_SUPABASE_ANON_KEY enthält einen geheimen Key (service_role). Bitte den anon/publishable Key verwenden.')
}

export const supabaseConfigProblem: 'secret-key' | null = keyIsSecret ? 'secret-key' : null

export const isSupabaseConfigured = Boolean(url && rawKey && !keyIsSecret)

export const supabase = isSupabaseConfigured
  ? createClient(url!, rawKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'habit-tracker-auth',
      },
    })
  : null
