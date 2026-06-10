import { NavLink } from 'react-router-dom'
import './TabBar.css'
export type Tab = { to: string; label: string; soon?: boolean }
export default function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="tabbar">
      {tabs.map(t => t.soon
        ? <span key={t.label} className="tab tab-soon" title="即將推出" aria-disabled="true">{t.label}<em>即將推出</em></span>
        : <NavLink key={t.label} to={t.to} end className={({ isActive }) => `tab ${isActive ? 'tab-on' : ''}`}>{t.label}</NavLink>
      )}
    </nav>
  )
}
