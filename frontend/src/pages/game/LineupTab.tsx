import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, useToast } from '../../ui'
import '../teams.css'
import '../games.css'

const POSITIONS: Record<string, string[]> = {
  baseball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  softball_fast: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  softball_slow: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SF'],
  teeball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
}
type Slot = { _k: string; playerId?: string; guestName?: string; battingOrder?: number; fieldPosition?: string; lineupStatus: string }
let _seq = 0
const nextKey = () => `slot-${_seq++}`

export default function LineupTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [players, setPlayers] = useState<any[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [result, setResult] = useState<{ valid: boolean; violations: { code: string; message: string }[] } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!game) return
    let cancelled = false
    ;(async () => {
      const ps = await api.players.list(game.teamId).catch(() => [])
      const r = await api.roster.get(gameId!).catch(() => ({ slots: [] }))
      if (cancelled) return
      setPlayers(ps)
      setSlots((r.slots ?? []).map((s: any) => ({ ...s, _k: nextKey() })))
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [gameId])

  const positions = game ? (POSITIONS[game.sportType] ?? POSITIONS.baseball) : []

  function addSlot() {
    const k = nextKey() // 在 updater 外取 key，保持 setState updater 純函式（StrictMode 雙呼叫安全）
    setSlots(s => [...s, { _k: k, lineupStatus: 'starter', battingOrder: s.filter(x => x.lineupStatus === 'starter').length + 1 }])
  }
  function update(i: number, patch: Partial<Slot>) {
    setSlots(s => s.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }
  function removeSlot(i: number) { setSlots(s => s.filter((_, idx) => idx !== i)) }

  async function save() {
    const body = { slots: slots.map(s => ({
      playerId: s.playerId || undefined,
      guestName: s.playerId ? undefined : (s.guestName || undefined),
      battingOrder: s.battingOrder ?? undefined,
      fieldPosition: s.fieldPosition || undefined,
      lineupStatus: s.lineupStatus,
    })) }
    try { await api.roster.put(gameId!, body); toast.show('名單已儲存（草稿）'); setResult(null) }
    catch { toast.show('儲存失敗：每列需恰選一名球員或填一位路人。', 'error') }
  }
  async function validate() {
    await save()
    const r = await api.roster.validate(gameId!)
    setResult(r)
  }
  async function confirm() {
    await save()
    try {
      await api.games.update(gameId!, { gameStatus: 'lineup_confirmed' })
      setResult({ valid: true, violations: [] }); toast.show('名單已確認'); reload()
    } catch (e: any) {
      if (e.status === 422 && e.body?.violations) setResult({ valid: false, violations: e.body.violations })
      else toast.show('確認失敗', 'error')
    }
  }

  const localWarnings: string[] = []
  if (game) {
    const starters = slots.filter(s => s.lineupStatus === 'starter')
    if (!starters.some(s => s.fieldPosition === 'P')) localWarnings.push('尚未指定投手（P）')
    const orders = starters.map(s => s.battingOrder).filter(Boolean)
    if (new Set(orders).size !== orders.length) localWarnings.push('打序有重複')
  }

  if (!game) return null

  return (
    <section>
      {localWarnings.length > 0 && <p role="alert" className="warn">提醒：{localWarnings.join('、')}</p>}
      {!loaded && <p role="status">載入中…</p>}
      {loaded && <>
        <table className="table">
          <thead><tr><th>打序</th><th>球員 / 路人</th><th>守位</th><th>先發/替補</th><th></th></tr></thead>
          <tbody>
            {slots.map((s, i) => (
              <tr key={s._k}>
                <td><input type="number" min={1} value={s.battingOrder ?? ''} style={{ width: 56 }}
                  onChange={e => update(i, { battingOrder: e.target.value ? Number(e.target.value) : undefined })} /></td>
                <td>
                  <select value={s.playerId ?? '__guest'} onChange={e =>
                    update(i, e.target.value === '__guest' ? { playerId: undefined } : { playerId: e.target.value, guestName: undefined })}>
                    <option value="__guest">路人…</option>
                    {players.map(p => <option key={p.playerId} value={p.playerId}>{p.displayName}{p.uniformNumber ? ` #${p.uniformNumber}` : ''}</option>)}
                  </select>
                  {!s.playerId && <input placeholder="路人名稱" value={s.guestName ?? ''} onChange={e => update(i, { guestName: e.target.value })} />}
                </td>
                <td>
                  <select value={s.fieldPosition ?? ''} onChange={e => update(i, { fieldPosition: e.target.value || undefined })}>
                    <option value="">（無 / 只打）</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td>
                  <select value={s.lineupStatus} onChange={e => update(i, { lineupStatus: e.target.value })}>
                    <option value="starter">先發</option><option value="bench">替補</option>
                  </select>
                </td>
                <td className="row-actions"><Button variant="ghost" onClick={() => removeSlot(i)}>移除</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline-form" style={{ marginTop: 12 }}>
          <Button variant="ghost" onClick={addSlot}>＋ 新增一列</Button>
          <Button variant="ghost" onClick={save}>儲存草稿</Button>
          <Button variant="ghost" onClick={validate}>驗證名單</Button>
          <Button onClick={confirm}>確認名單</Button>
        </div>

        {result && (
          <div style={{ marginTop: 16 }}>
            {result.valid
              ? <p role="status" className="ok">✓ 名單合法</p>
              : <div role="alert"><strong>名單不合法：</strong>
                <ul>{result.violations.map((v, i) => <li key={i}>{v.message}</li>)}</ul>
              </div>}
          </div>
        )}
      </>}
    </section>
  )
}
