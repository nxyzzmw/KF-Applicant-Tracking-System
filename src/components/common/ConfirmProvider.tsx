import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Button from './Button'
import Modal from './Modal'

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void
}

type ConfirmProviderProps = {
  children: ReactNode
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  function closeWith(result: boolean) {
    if (!pending) return
    pending.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(pending)}
        title={pending?.title ?? 'Confirm Action'}
        onClose={() => closeWith(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => closeWith(false)}>
              {pending?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant="danger" onClick={() => closeWith(true)}>
              {pending?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p>{pending?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context
}
