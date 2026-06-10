import './Chip.css'
export function Chip({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'warning' | 'info' | 'muted' }) {
  return <span className={`ui-chip ui-chip-${tone}`}>{children}</span>
}
const GAME_STATUS: Record<string, { label: string; tone: 'muted' | 'info' | 'accent' }> = {
  draft: { label: '草稿', tone: 'muted' },
  scheduled: { label: '已排定', tone: 'info' },
  lineup_confirmed: { label: '名單已確認', tone: 'accent' },
}
export function StatusBadge({ status }: { status: string }) {
  const s = GAME_STATUS[status] ?? { label: status, tone: 'muted' as const }
  return <Chip tone={s.tone}>{s.label}</Chip>
}
