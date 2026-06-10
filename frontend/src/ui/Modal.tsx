import { useEffect, useId, useRef } from 'react'
import './Modal.css'
type Props = { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }
export default function Modal({ open, title, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const f = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!f || f.length === 0) { e.preventDefault(); return }
      const first = f[0], last = f[f.length - 1], active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}
        tabIndex={-1} ref={panelRef} onClick={e => e.stopPropagation()}>
        {title && <h2 id={titleId} className="ui-modal-title">{title}</h2>}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
