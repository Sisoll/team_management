import { createContext, useCallback, useContext, useState } from 'react'
import './Toast.css'
type Toast = { id: number; tone: 'success' | 'error'; text: string }
type Ctx = { show: (text: string, tone?: 'success' | 'error') => void }
const ToastCtx = createContext<Ctx>({ show: () => {} })
export const useToast = () => useContext(ToastCtx)
let _id = 0
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = ++_id
    setItems(s => [...s, { id, tone, text }])
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="ui-toast-stack" aria-live="polite">
        {items.map(t => <div key={t.id} className={`ui-toast ui-toast-${t.tone}`}
          role={t.tone === 'error' ? 'alert' : 'status'}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
