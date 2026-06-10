import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Card, Input, Select, EmptyState, Skeleton, useToast } from '../ui'
import './teams.css'

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[] | null>(null)
  const [name, setName] = useState(''); const [sport, setSport] = useState('baseball')
  const nav = useNavigate(); const toast = useToast()
  const load = () => api.teams.list().then(setTeams)
  useEffect(() => { load() }, [])
  async function create() {
    if (!name.trim()) return
    try { await api.teams.create({ teamName: name, sportType: sport }); setName(''); toast.show('球隊已建立'); load() }
    catch { toast.show('建立失敗', 'error') }
  }
  return (
    <section>
      <h1 className="page-title">我的球隊</h1>
      <div className="inline-form">
        <Input placeholder="球隊名稱" value={name} onChange={e => setName(e.target.value)} />
        <Select value={sport} onChange={e => setSport(e.target.value)}>
          <option value="baseball">棒球</option><option value="softball_fast">快壘</option>
          <option value="softball_slow">慢壘</option><option value="teeball">樂樂棒球</option>
        </Select>
        <Button onClick={create}>建立球隊</Button>
      </div>
      {teams === null && <Skeleton rows={3} />}
      {teams && teams.length === 0 && <EmptyState>尚無球隊，先建立一支吧</EmptyState>}
      <div className="card-grid">
        {teams?.map(t => (
          <Card key={t.teamId} interactive onClick={() => nav(`/teams/${t.teamId}`)}>
            <h3>{t.teamName}</h3>
            <p className="muted">{t.sportType} · {t.myRoles.join(', ')}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
