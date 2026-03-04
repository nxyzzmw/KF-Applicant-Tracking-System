import type { ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  actions?: ReactNode
  onClose: () => void
}

function Modal({ open, title, children, actions, onClose }: ModalProps) {
  if (!open) return null
  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ui-modal__head">
          <h3>{title}</h3>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {actions && <footer className="ui-modal__actions">{actions}</footer>}
      </div>
    </div>
  )
}

export default Modal
