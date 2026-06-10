import { useOutletContext } from 'react-router-dom'
import { Card } from '../../ui'
import '../games.css'

export default function InfoTab() {
  const { game } = useOutletContext<{ game: any }>()
  if (!game) return null
  const rules = [game.dhEnabled && 'DH', game.epAllowed && 'EP', game.reEntryAllowed && '再上場'].filter(Boolean).join(' / ') || '無'
  const rows: [string, any][] = [
    ['對手', game.opponentName ?? '隊內對抗'], ['日期', game.gameDate],
    ['主/客', game.homeAway === 'home' ? '主場' : '客場'], ['賽事模式', game.matchMode],
    ['規則', rules], ['人數基準', game.rosterSize],
    ['地點', game.venue ?? '—'], ['天氣', game.weather ?? '—'],
    ['溫度', game.temperatureC != null ? `${game.temperatureC}℃` : '—'],
  ]
  return (
    <Card>
      <dl className="info-grid">
        {rows.map(([k, v]) => <div key={k} className="info-row"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </Card>
  )
}
