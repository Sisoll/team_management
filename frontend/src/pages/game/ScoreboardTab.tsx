import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import BasesDiamond from './BasesDiamond'
import './recording.css'

export default function ScoreboardTab() {
  const { game } = useOutletContext<{ game: any }>()
  const gameId = game?.gameId
  const [state, setState] = useState<any>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!gameId) return
    api.games.state(gameId).then(r => setState(r.state)).catch(() => {})
    const stop = api.events.stream(gameId,
      r => { if (r?.state) { setState(r.state); setLive(true) } },
      () => setLive(false))
    return stop
  }, [gameId])

  if (!state) return <section><p role="status">尚無記錄。</p></section>
  const b = state.bases ?? {}
  const batter = state.lineup?.find((e: any) => e.battingOrder === state.currentBatterOrder)
  const line: number[][] = state.lineScore ?? []
  return (
    <section className="scoreboard">
      <div className="sb-score">
        <div className="sb-team"><span>對手</span><strong>{state.scoreOpp}</strong></div>
        <div className="sb-team"><span>我隊</span><strong>{state.scoreUs}</strong></div>
        <span className={`sb-live ${live ? 'on' : ''}`}>{live ? '● LIVE' : '○ 離線'}</span>
      </div>

      <table className="sb-line">
        <thead><tr><th></th>{line.map(r => <th key={r[0]}>{r[0]}</th>)}<th>R</th></tr></thead>
        <tbody>
          <tr><th>上</th>{line.map(r => <td key={r[0]}>{r[1]}</td>)}<td>{line.reduce((a, r) => a + r[1], 0)}</td></tr>
          <tr><th>下</th>{line.map(r => <td key={r[0]}>{r[2]}</td>)}<td>{line.reduce((a, r) => a + r[2], 0)}</td></tr>
        </tbody>
      </table>

      <div className="sb-situation">
        <span>{state.inning} 局{state.half === 'top' ? '上' : '下'}</span>
        <span>{state.outs} 出局</span>
        <BasesDiamond bases={b} />
      </div>

      <div className="sb-now">
        {state.battingSide === 'offense'
          ? <>打擊：第 {state.currentBatterOrder} 棒 {batter?.guestName ?? '球員'}</>
          : <>我隊守備中</>}
      </div>
    </section>
  )
}
