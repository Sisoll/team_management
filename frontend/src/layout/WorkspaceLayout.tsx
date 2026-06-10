import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { useTeams } from '../teams/TeamsProvider'
import { Skeleton } from '../ui'
import './WorkspaceLayout.css'

const SPORT: Record<string, string> = { baseball: '棒球', softball_fast: '快壘', softball_slow: '慢壘', teeball: '樂樂棒' }

export default function WorkspaceLayout() {
  const { teams, loading } = useTeams()
  // teamId 僅在 /teams/:teamId 路由有值；/games/:gameId 時為 undefined（側邊欄照常顯示，但不 highlight）
  const { teamId } = useParams()
  const nav = useNavigate()
  return (
    <div className="ws">
      <aside className="ws-side">
        <div className="ws-side-lab">球隊</div>
        {loading && <Skeleton rows={3} />}
        {!loading && teams.length === 0 && <p className="ws-side-empty">右上角「建立球隊」開始</p>}
        {teams.map(t => (
          <button key={t.teamId} className={`ws-team ${t.teamId === teamId ? 'on' : ''}`}
            onClick={() => nav(`/teams/${t.teamId}`)}>
            <span className="ws-team-name">{t.teamName}</span>
            <span className="ws-team-meta">{SPORT[t.sportType] ?? t.sportType}{t.myRoles?.length ? ` · ${t.myRoles.join('/')}` : ''}</span>
          </button>
        ))}
      </aside>
      <div className="ws-main"><Outlet /></div>
    </div>
  )
}
