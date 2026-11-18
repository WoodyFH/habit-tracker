// Bestätigungsdialog als kleines Bottom Sheet (Promise-basiert).
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './ui'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx)
  if (!fn) throw new Error('ConfirmProvider fehlt')
  return fn
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Sheet open={!!opts} onClose={() => close(false)} title={opts?.title}>
        {opts?.message && <p className="mb-5 text-[15px] leading-relaxed text-muted">{opts.message}</p>}
        <div className="flex flex-col gap-2">
          <Button variant={opts?.danger ? 'danger' : 'solid'} size="lg" onClick={() => close(true)}>
            {opts?.confirmLabel ?? 'OK'}
          </Button>
          <Button size="lg" onClick={() => close(false)}>
            Abbrechen
          </Button>
        </div>
      </Sheet>
    </Ctx.Provider>
  )
}
