import { useEffect, useRef } from 'react'
import './Modal.css'
type Props = { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }
export default function Modal({ open, title, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title}
        tabIndex={-1} ref={panelRef} onClick={e => e.stopPropagation()}>
        {title && <h2 className="ui-modal-title">{title}</h2>}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
