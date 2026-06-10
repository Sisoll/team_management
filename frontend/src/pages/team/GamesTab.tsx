import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '../../ui'
import '../teams.css'; import '../games.css'

export default function GamesTab() {
  const teamId = useParams().teamId!
  const [games, setGames] = useState<any[] | null>(null)
  const nav = useNavigate()
  useEffect(() => { teamId && api.games.list(teamId).then(setGames).catch(() => setGames([])) }, [teamId])
  return (
    <section>
      <div className="page-head">
        <h2>比賽</h2>
        <Button onClick={() => nav(`/teams/${teamId}/games/new`)}>建立比賽</Button>
      </div>
      {games === null && <Skeleton rows={3} />}
      {games && games.length === 0 && <EmptyState>尚無比賽</EmptyState>}
      <div className="game-list">
        {games?.map(g => (
          <Card key={g.gameId} interactive className="game-card" onClick={() => nav(`/games/${g.gameId}`)}>
            <div>
              <strong>{g.opponentName ?? '隊內對抗'}</strong>
              <div className="meta">{g.gameDate} · {g.homeAway === 'home' ? '主場' : '客場'} · {g.matchMode}</div>
            </div>
            <StatusBadge status={g.gameStatus} />
          </Card>
        ))}
      </div>
    </section>
  )
}
