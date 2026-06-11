import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, EmptyState, useToast } from '../../ui'

const LABEL: Record<string, string> = {
  SINGLE: '一壘安打', DOUBLE: '二壘安打', TRIPLE: '三壘安打', HOME_RUN: '全壘打',
  WALK: '保送', HIT_BY_PITCH: '觸身球', STRIKEOUT: '三振', GROUND_OUT: '滾地出局',
  FLY_OUT: '飛球出局', FIELDERS_CHOICE: '野手選擇', SAC_FLY: '高飛犧牲', SAC_BUNT: '犧牲觸擊',
  REACH_ON_ERROR: '失誤上壘', PINCH_HIT: '代打', PINCH_RUN: '代跑', POSITION_CHANGE: '守位調整',
  PITCHER_CHANGE: '換投', RE_ENTRY: '再上場', BASE_RUNNING: '跑壘',
}

export default function TimelineTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [events, setEvents] = useState<any[] | null>(null)
  const load = useCallback(() => {
    if (!gameId) return
    api.events.list(gameId).then(setEvents).catch(() => setEvents([]))
  }, [gameId])
  useEffect(() => { load() }, [load])

  async function remove(eventId: string) {
    try { await api.events.remove(gameId!, eventId); toast.show('已刪除並重算'); load(); reload() }
    catch { toast.show('刪除失敗（比賽需在進行中）', 'error') }
  }

  if (!game) return null
  if (!events) return <section><p role="status">載入中…</p></section>
  if (events.length === 0) return <section><EmptyState>尚無事件記錄</EmptyState></section>

  return (
    <section>
      <table className="table">
        <thead><tr><th>#</th><th>局</th><th>事件</th><th>得分</th><th>出局</th><th></th></tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={e.eventId}>
              <td>{e.sequenceNo}</td>
              <td>{e.inning}{e.half === 'top' ? '上' : '下'}</td>
              <td>{LABEL[e.eventType] ?? e.eventType}</td>
              <td>{e.scoreDelta > 0 ? `+${e.scoreDelta}` : ''}</td>
              <td>{e.outsAfter}</td>
              <td className="row-actions">
                {(game.gameStatus === 'live' || game.gameStatus === 'paused') &&
                  <Button variant="ghost" onClick={() => remove(e.eventId)}>刪除</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="subtitle" style={{ marginTop: 8 }}>刪除任一筆會從該點重算後續比分與壘包（AC-11）。</p>
    </section>
  )
}
