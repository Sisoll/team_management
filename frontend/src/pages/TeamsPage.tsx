import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import '../pages/LoginPage.css'
import './teams.css'

export default function TeamsPage({ me, onLogout }: { me: any; onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [name, setName] = useState(''); const [sport, setSport] = useState('baseball')
  const nav = useNavigate()
  const load = () => api.teams.list().then(setTeams)
  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    await api.teams.create({ teamName: name, sportType: sport })
    setName(''); load()
  }
  return (
    <main className="page">
      <div className="page-head">
        <h1>我的球隊</h1>
        <div>嗨，{me.displayName}　<button className="btn btn-ghost" onClick={onLogout}>登出</button></div>
      </div>
      <div className="inline-form">
        <input placeholder="球隊名稱" value={name} onChange={e => setName(e.target.value)} />
        <select value={sport} onChange={e => setSport(e.target.value)}>
          <option value="baseball">棒球</option>
          <option value="softball_fast">快壘</option>
          <option value="softball_slow">慢壘</option>
          <option value="teeball">樂樂棒球</option>
        </select>
        <button className="btn btn-primary" onClick={create}>建立球隊</button>
      </div>
      <div className="card-grid">
        {teams.map(t => (
          <div key={t.teamId} className="team-card" onClick={() => nav(`/teams/${t.teamId}`)}>
            <h3>{t.teamName}</h3>
            <p className="muted">{t.sportType} · {t.myRoles.join(', ')}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
