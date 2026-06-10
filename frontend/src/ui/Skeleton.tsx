import './Skeleton.css'
export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="ui-skeleton" aria-busy="true" aria-label="載入中">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="ui-skeleton-row" />)}
  </div>
}
