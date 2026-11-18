import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { Button, TextInput } from './ui'

export function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const err = await signIn(email, password)
      if (err) setError(err)
    } catch (ex) {
      setError(`Anmeldung fehlgeschlagen: ${(ex as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pt-safe pb-safe pl-safe pr-safe grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6 rounded-[32px] bg-card p-7 shadow-card" aria-labelledby="login-title">
        <div className="space-y-4 text-center">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={72} height={72} className="mx-auto size-[72px] rounded-[22px] shadow-card" />
          <div>
            <h1 id="login-title" className="text-2xl font-bold tracking-tight">
              Habit Tracker
            </h1>
            <p className="mt-1 text-sm text-muted">Privater Zugang – bitte anmelden.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-muted">E-Mail</span>
            <TextInput type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.at" autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-muted">Passwort</span>
            <div className="relative">
              <TextInput type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
              <button
                type="button"
                aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
                onClick={() => setShow((s) => !s)}
                className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted"
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-[#ef4444]/10 px-3 py-2.5 text-sm font-medium text-[#ef4444]">
            {error}
          </p>
        )}

        <Button type="submit" variant="solid" size="lg" className="w-full" disabled={busy || !email || !password}>
          <LogIn size={20} /> {busy ? 'Anmelden …' : 'Anmelden'}
        </Button>
      </form>
    </main>
  )
}
