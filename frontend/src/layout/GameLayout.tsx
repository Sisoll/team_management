import { useCallback, useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumb from './Breadcrumb'
import TabBar, { Tab } from './TabBar'
import { StatusBadge } from '../ui'

export default function GameLayout() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const reload = useCallback(() => {
    api.games.get(gameId!).then(async (g: any) => {
      setGame(g)
      setTeam(await api.teams.get(g.teamId).catch(() => null))
    }).catch(() => nav('/'))
  }, [gameId, nav])
  useEffect(() => { reload() }, [reload])

  const base = `/games/${gameId}`
  const tabs: Tab[] = [
    { to: `${base}/info`, label: '資訊' },
    { to: `${base}/lineup`, label: '出賽名單' },
    { to: `${base}/record`, label: '記錄', soon: true },
    { to: `${base}/scoreboard`, label: '計分板', soon: true },
    { to: `${base}/box`, label: '數據', soon: true },
    { to: `${base}/timeline`, label: '時間線', soon: true },
  ]
  const title = game ? (game.opponentName ?? '隊內對抗') : '…'
  return (
    <>
      <Breadcrumb
        items={[{ label: '我的球隊', to: '/' },
          { label: team?.teamName ?? '球隊', to: game ? `/teams/${game.teamId}/games` : '/' },
          { label: title }]}
        trailing={game && <StatusBadge status={game.gameStatus} />} />
      <TabBar tabs={tabs} />
      <Outlet context={{ game, reload }} />
    </>
  )
}
