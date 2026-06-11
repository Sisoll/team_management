import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, useToast } from '../../ui'
import './recording.css'

// L2 結果面板：label → eventType；out=是否使打者出局、base=打者上壘目的（安打/保送）
const RESULTS: { label: string; type: string; to: string }[] = [
  { label: '1B', type: 'SINGLE', to: '1' }, { label: '2B', type: 'DOUBLE', to: '2' },
  { label: '3B', type: 'TRIPLE', to: '3' }, { label: 'HR', type: 'HOME_RUN', to: 'H' },
  { label: '保送', type: 'WALK', to: '1' }, { label: '觸身', type: 'HIT_BY_PITCH', to: '1' },
  { label: '三振', type: 'STRIKEOUT', to: 'OUT' }, { label: '野選', type: 'FIELDERS_CHOICE', to: 'OUT' },
  { label: '滾地', type: 'GROUND_OUT', to: 'OUT' }, { label: '飛球', type: 'FLY_OUT', to: 'OUT' },
  { label: '犧飛', type: 'SAC_FLY', to: 'OUT' }, { label: '失誤', type: 'REACH_ON_ERROR', to: '1' },
]

export default function RecordTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [state, setState] = useState<any>(null)
  const [pitch, setPitch] = useState({ pitches: 0, strikes: 0, balls: 0, swinging: 0, looking: 0 })
  const [pending, setPending] = useState<{ type: string; batterTo: string } | null>(null)

  const loadState = useCallback(() => {
    if (!gameId) return
    api.games.state(gameId).then(r => setState(r.state)).catch(() => setState(null))
  }, [gameId])
  useEffect(() => { loadState() }, [loadState, game?.gameStatus])

  async function open() {
    await api.games.start(gameId!, { recordingDetail: 'L2', symmetricOpponent: false })
    reload(); loadState()
  }

  function bumpPitch(kind: 'strike-swing' | 'strike-look' | 'ball') {
    setPitch(p => ({
      pitches: p.pitches + 1,
      strikes: p.strikes + (kind === 'ball' ? 0 : 1),
      balls: p.balls + (kind === 'ball' ? 1 : 0),
      swinging: p.swinging + (kind === 'strike-swing' ? 1 : 0),
      looking: p.looking + (kind === 'strike-look' ? 1 : 0),
    }))
  }

  function basesOccupied() {
    const b = state?.bases ?? {}
    return ['1', '2', '3'].filter(k => b[{ '1': 'first', '2': 'second', '3': 'third' }[k] as string])
  }

  async function send(eventType: string, runnerMoves: { from: string; to: string }[]) {
    const body: any = { eventType, runnerMoves }
    if (state?.battingSide === 'defense' && pitch.pitches > 0) body.pitches = pitch
    try {
      await api.events.record(gameId!, body)
      setPitch({ pitches: 0, strikes: 0, balls: 0, swinging: 0, looking: 0 }); setPending(null)
      loadState()
    } catch { toast.show('記錄失敗', 'error') }
  }

  function clickResult(r: { type: string; to: string }) {
    const batterMove = r.to === 'OUT' ? { from: 'B', to: 'OUT' } : { from: 'B', to: r.to }
    const occ = basesOccupied()
    if (occ.length === 0) { send(r.type, [batterMove]); return }
    // 有跑者 → 進跑者處理（簡化：預設保送類強迫進壘、其餘留壘，使用者可在面板調整）
    setPending({ type: r.type, batterTo: r.to })
  }

  async function undo() {
    const evs = await api.events.list(gameId!)
    if (!evs.length) return
    await api.events.remove(gameId!, evs[evs.length - 1].eventId)
    loadState()
  }

  if (!game) return null
  if (game.gameStatus === 'lineup_confirmed')
    return <section><p>名單已確認，準備開賽。</p><Button onClick={open}>開賽（L2 標準記錄）</Button></section>
  if (game.gameStatus === 'scheduled' || game.gameStatus === 'draft')
    return <section><p role="alert" className="warn">尚未確認名單，請先到「出賽名單」確認。</p></section>
  if (!state) return <section><p role="status">載入中…</p></section>

  const b = state.bases ?? {}
  const batter = state.lineup?.find((e: any) => e.battingOrder === state.currentBatterOrder)

  return (
    <section>
      <div className="rec-statebar">
        <span>客 {state.scoreOpp} : {state.scoreUs} 主</span>
        <span>{state.inning} 局{state.half === 'top' ? '上' : '下'} · {state.outs} 出局 · {state.battingSide === 'offense' ? '我隊進攻' : '我隊守備'}</span>
        <span>壘包 {[b.first && '1', b.second && '2', b.third && '3'].filter(Boolean).join('·') || '空'}</span>
      </div>

      <div className="rec-batter">
        {state.battingSide === 'offense'
          ? <>打擊　第 {state.currentBatterOrder} 棒 {batter?.guestName ?? '球員'}</>
          : <>守備　投手記錄
            <div className="rec-pitch">
              球數 好{pitch.strikes} 壞{pitch.balls} 用球{pitch.pitches}
              <Button variant="ghost" onClick={() => bumpPitch('strike-swing')}>揮空</Button>
              <Button variant="ghost" onClick={() => bumpPitch('strike-look')}>站著好球</Button>
              <Button variant="ghost" onClick={() => bumpPitch('ball')}>壞球</Button>
            </div>
          </>}
      </div>

      {!pending && <div className="rec-palette">
        {RESULTS.map(r => <Button key={r.label} variant="ghost" onClick={() => clickResult(r)}>{r.label}</Button>)}
      </div>}

      {pending && <RunnerPanel state={state} pending={pending} onCancel={() => setPending(null)}
        onConfirm={(moves) => send(pending.type, moves)} />}

      <div className="rec-actions">
        <Button variant="ghost" onClick={undo}>⤺ 撤銷上一筆</Button>
        {game.gameStatus === 'live' && <Button variant="ghost" onClick={() => api.games.pause(gameId!).then(reload)}>暫停</Button>}
        {game.gameStatus === 'paused' && <Button variant="ghost" onClick={() => api.games.resume(gameId!).then(reload)}>繼續</Button>}
        <Button onClick={() => api.games.complete(gameId!).then(reload)}>結束比賽</Button>
      </div>
    </section>
  )
}

/** 跑者處理：每位在壘跑者選 留/進壘/得分/出局，加上打者去向，組 runnerMoves。 */
function RunnerPanel({ state, pending, onConfirm, onCancel }:
  { state: any; pending: { type: string; batterTo: string }; onConfirm: (m: { from: string; to: string }[]) => void; onCancel: () => void }) {
  const b = state.bases ?? {}
  const runners = [
    b.third && { from: '3' }, b.second && { from: '2' }, b.first && { from: '1' },
  ].filter(Boolean) as { from: string }[]
  const [dest, setDest] = useState<Record<string, string>>(
    Object.fromEntries(runners.map(r => [r.from, r.from])))   // 預設留原壘
  const opts = (from: string) => ['留', String(Number(from) + 1) <= '3' ? String(Number(from) + 1) : 'H', 'H', 'OUT']
  function confirm() {
    const moves = runners.map(r => ({ from: r.from, to: dest[r.from] === '留' ? r.from : dest[r.from] }))
    const batterMove = pending.batterTo === 'OUT' ? { from: 'B', to: 'OUT' } : { from: 'B', to: pending.batterTo }
    onConfirm([...moves, batterMove])
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, marginTop: 8 }}>
      <p>跑者處理（{pending.type}）：</p>
      {runners.map(r => (
        <div key={r.from} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0' }}>
          <span style={{ width: 64 }}>{r.from} 壘跑者</span>
          {opts(r.from).map(o => (
            <Button key={o} variant={dest[r.from] === o ? 'primary' : 'ghost'}
              onClick={() => setDest(d => ({ ...d, [r.from]: o }))}>{o === '留' ? '留原壘' : o === 'H' ? '得分' : o === 'OUT' ? '出局' : `→${o}壘`}</Button>
          ))}
        </div>
      ))}
      <div className="rec-actions">
        <Button onClick={confirm}>確認</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}
