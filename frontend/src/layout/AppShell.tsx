import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalTabBar from './GlobalTabBar'
import CreateTeamModal from '../teams/CreateTeamModal'
import './AppShell.css'

export default function AppShell({ userName, onLogout, children }:
  { userName: string; onLogout: () => void; children: React.ReactNode }) {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button className="app-brand" onClick={() => nav('/teams')}>⚾ 紀錄台</button>
        <div className="app-topbar-right">
          <button className="app-create-btn" onClick={() => setCreateOpen(true)}>＋ 建立球隊</button>
          <div className="app-account" ref={accountRef}>
            <button className="app-account-btn" onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen}>
              👤 {userName} ▾
            </button>
            {menuOpen && (
              <div className="app-account-menu" role="menu">
                <button role="menuitem" onClick={onLogout}>登出</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <GlobalTabBar />
      <main className="app-content">{children}</main>
      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
