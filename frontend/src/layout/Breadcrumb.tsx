import { Link } from 'react-router-dom'
import './Breadcrumb.css'
export type Crumb = { label: string; to?: string }
export default function Breadcrumb({ items, trailing }: { items: Crumb[]; trailing?: React.ReactNode }) {
  return (
    <div className="crumbs">
      {items.map((c, i) => (
        <span key={i} className="crumb">
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="crumb-current">{c.label}</span>}
          {i < items.length - 1 && <span className="crumb-sep">›</span>}
        </span>
      ))}
      {trailing && <span className="crumb-trailing">{trailing}</span>}
    </div>
  )
}
