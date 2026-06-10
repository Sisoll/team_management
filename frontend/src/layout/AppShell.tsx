import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AppShell.css'
export default function AppShell({ userName, onLogout, children }:
  { userName: string; onLogout: () => void; children: React.ReactNode }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button className="app-brand" onClick={() => nav('/')}>⚾ 紀錄台</button>
        <div className="app-account">
          <button className="app-account-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}>
            👤 {userName} ▾
          </button>
          {open && (
            <div className="app-account-menu" role="menu">
              <button role="menuitem" onClick={onLogout}>登出</button>
            </div>
          )}
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  )
}
