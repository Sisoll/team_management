import './EmptyState.css'
export default function EmptyState({ icon = '📭', children }: { icon?: string; children: React.ReactNode }) {
  return <div className="ui-empty"><div className="ui-empty-icon" aria-hidden="true">{icon}</div><p>{children}</p></div>
}
