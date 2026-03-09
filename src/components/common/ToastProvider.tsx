import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Modal from './Modal'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  type: ToastType
  message: string
}

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

type ToastProviderProps = {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [errorModals, setErrorModals] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    if (type === 'error') {
      setErrorModals((prev) => [...prev, { id, message, type }])
      return
    }
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3200)
  }, [])

  useEffect(() => {
    function handleGlobalToast(event: Event) {
      const custom = event as CustomEvent<{ message?: string; type?: ToastType }>
      if (!custom.detail?.message) return
      showToast(custom.detail.message, custom.detail.type ?? 'info')
    }
    window.addEventListener('ats:toast', handleGlobalToast)
    return () => window.removeEventListener('ats:toast', handleGlobalToast)
  }, [showToast])

  const value = useMemo(() => ({ showToast }), [showToast])
  const activeErrorModal = errorModals[0] ?? null

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(activeErrorModal)}
        title="Error"
        onClose={() => setErrorModals((prev) => prev.slice(1))}
        actions={(
          <button type="button" className="primary-btn" onClick={() => setErrorModals((prev) => prev.slice(1))}>
            OK
          </button>
        )}
      >
        <p className="panel-message panel-message--error" style={{ margin: 0 }}>
          {activeErrorModal?.message}
        </p>
      </Modal>
      <div className="ui-toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ui-toast--${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
