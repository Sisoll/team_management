import { Link, useLocation } from 'react-router-dom'
import './GlobalTabBar.css'

type GTab = { to: string; label: string; soon?: string; match?: (p: string) => boolean }
const TABS: GTab[] = [
  { to: '/overview', label: '總覽', soon: '尚未實作' },
  { to: '/teams', label: '我的球隊', match: p => p.startsWith('/teams') || p.startsWith('/games') },
  { to: '/calendar', label: '行事曆', soon: '即將推出' },
  { to: '/stats', label: '統計', soon: '即將推出' },
]

export default function GlobalTabBar() {
  const { pathname } = useLocation()
  return (
    <nav className="gtabbar">
      {TABS.map(t => {
        if (t.soon) return (
          <span key={t.label} role="link" aria-disabled="true" className="gtab gtab-soon" title={t.soon}>
            {t.label}<em>{t.soon}</em>
          </span>
        )
        const active = t.match ? t.match(pathname) : pathname === t.to
        return <Link key={t.label} to={t.to} className={`gtab ${active ? 'gtab-on' : ''}`}>{t.label}</Link>
      })}
    </nav>
  )
}
