// Supabase-Client. Im Frontend stehen NUR die Projekt-URL und der öffentliche anon key
// (aus Umgebungsvariablen). Niemals einen service_role Key verwenden!
import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey && url.startsWith('http'))

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'habit-tracker-auth',
      },
    })
  : null
