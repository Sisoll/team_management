import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { STATUS_LABEL } from './GameCreatePage'
import '../pages/LoginPage.css'
import './teams.css'
import './games.css'

export default function TeamPage() {
  const { teamId } = useParams()
  const nav = useNavigate()
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [name, setName] = useState(''); const [num, setNum] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [games, setGames] = useState<any[]>([])

  const load = () => {
    api.teams.get(teamId!).then(setTeam).catch(() => nav('/'))
    api.players.list(teamId!, includeArchived ? '?includeArchived=true' : '').then(setPlayers)
  }
  useEffect(() => { load() }, [teamId, includeArchived])
  useEffect(() => { api.games.list(teamId!).then(setGames).catch(() => setGames([])) }, [teamId])

  async function addPlayer() {
    if (!name.trim()) return
    await api.players.create(teamId!, { displayName: name, uniformNumber: num || undefined })
    setName(''); setNum(''); load()
  }
  async function changeNumber(p: any) {
    const next = prompt(`新背號（${p.displayName}）`, p.uniformNumber ?? '')
    if (next === null) return
    await api.players.update(teamId!, p.playerId, { uniformNumber: next || undefined }); load()
  }
  async function remove(p: any) {
    if (!confirm(`封存球員 ${p.displayName}？`)) return
    await api.players.remove(teamId!, p.playerId); load()
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{team ? team.teamName : '…'}</h1>
        <button className="btn btn-ghost" onClick={() => nav('/')}>← 返回</button>
      </div>
      <div className="inline-form">
        <input placeholder="球員名稱" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="背號" value={num} onChange={e => setNum(e.target.value)} />
        <button className="btn btn-primary" onClick={addPlayer}>新增球員</button>
        <label style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} /> 顯示已封存
        </label>
      </div>
      <table className="table">
        <thead><tr><th>背號</th><th>名稱</th><th>守位</th><th>狀態</th><th></th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.playerId}>
              <td>{p.uniformNumber ?? '—'}</td>
              <td>{p.displayName}</td>
              <td>{p.primaryPositions.join(', ') || '—'}</td>
              <td>{p.rosterStatus}</td>
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => changeNumber(p)}>改背號</button>
                {p.rosterStatus !== 'archived' &&
                  <button className="btn btn-ghost" onClick={() => remove(p)}>封存</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="games-section">
        <div className="page-head">
          <h2>比賽</h2>
          <button className="btn btn-primary" onClick={() => nav(`/teams/${teamId}/games/new`)}>建立比賽</button>
        </div>
        <div className="game-list">
          {games.length === 0 && <p className="meta">尚無比賽</p>}
          {games.map(g => (
            <div key={g.gameId} className="game-card" onClick={() => nav(`/games/${g.gameId}`)}>
              <div>
                <strong>{g.opponentName ?? '隊內對抗'}</strong>
                <div className="meta">{g.gameDate} · {g.homeAway === 'home' ? '主場' : '客場'} · {g.matchMode}</div>
              </div>
              <span className="status-chip">{STATUS_LABEL[g.gameStatus] ?? g.gameStatus}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
