import { useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import TabBar, { Tab } from './TabBar'
import { Chip } from '../ui'
import './TeamLayout.css'

export default function TeamLayout() {
  const { teamId } = useParams()
  const nav = useNavigate()
  const [team, setTeam] = useState<any>(null)
  useEffect(() => { api.teams.get(teamId!).then(setTeam).catch(() => nav('/')) }, [teamId, nav])

  const base = `/teams/${teamId}`
  const tabs: Tab[] = [
    { to: `${base}/overview`, label: '總覽', soon: true },
    { to: `${base}/players`, label: '球員' },
    { to: `${base}/games`, label: '比賽' },
    { to: `${base}/calendar`, label: '行事曆', soon: true },
    { to: `${base}/stats`, label: '統計', soon: true },
    { to: `${base}/settings`, label: '設定', soon: true },
  ]
  const role = team?.myRoles?.[0] ?? '成員'
  return (
    <>
      <div className="team-head">
        <h2>{team?.teamName ?? '…'}</h2>
        <Chip tone="accent">你的身分：{role}</Chip>
      </div>
      <TabBar tabs={tabs} />
      <Outlet context={{ team }} />
    </>
  )
}
