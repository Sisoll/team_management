import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { useToast } from '../../ui'
import './recording.css'

export default function BoxTab() {
  const { game } = useOutletContext<{ game: any }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [box, setBox] = useState<any>(null)

  const load = useCallback(() => {
    if (gameId) api.games.boxScore(gameId).then(setBox).catch(() => setBox(null))
  }, [gameId])
  useEffect(() => { load() }, [load])

  async function editEr(p: any) {
    const input = window.prompt(`設定投手 ${p.name} 的自責分 (ER)`, String(p.er))
    if (input == null) return
    const er = parseInt(input, 10)
    if (Number.isNaN(er) || er < 0) { toast.show('請輸入非負整數', 'error'); return }
    try { setBox(await api.games.setEr(gameId!, p.playerId, er)) }
    catch { toast.show('修改失敗（需 owner 權限）', 'error') }
  }

  if (!box) return <section><p role="status">尚無數據。</p></section>
  return (
    <section>
      <table className="sb-line">
        <thead><tr><th></th>{box.lineScore.map((r: any) => <th key={r.inning}>{r.inning}</th>)}<th>R</th><th>H</th></tr></thead>
        <tbody>
          <tr><th>上</th>{box.lineScore.map((r: any) => <td key={r.inning}>{r.top}</td>)}<td>{box.opponent.runs}</td><td>{box.opponent.hits}</td></tr>
          <tr><th>下</th>{box.lineScore.map((r: any) => <td key={r.inning}>{r.bottom}</td>)}<td>{box.team.runs}</td><td>{box.team.hits}</td></tr>
        </tbody>
      </table>

      <h3>打擊（我隊）</h3>
      <table className="box-table">
        <thead><tr><th>打者</th><th>守</th><th>打席</th><th>打數</th><th>得分</th><th>安打</th><th>二</th><th>三</th><th>全</th><th>打點</th><th>四壞</th><th>三振</th><th>盜壘</th><th>打率</th></tr></thead>
        <tbody>
          {box.batting.map((p: any) => (
            <tr key={p.playerId}>
              <td>{p.order}. {p.name}</td><td>{p.position}</td><td>{p.pa}</td><td>{p.ab}</td><td>{p.r}</td>
              <td>{p.h}</td><td>{p.doubles}</td><td>{p.triples}</td><td>{p.hr}</td><td>{p.rbi}</td>
              <td>{p.bb}</td><td>{p.k}</td><td>{p.sb}</td><td>{p.avg}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>投球（我隊）</h3>
      <table className="box-table">
        <thead><tr><th>投手</th><th>局數</th><th>被安</th><th>失分</th><th>自責</th><th>四壞</th><th>三振</th><th>用球</th></tr></thead>
        <tbody>
          {box.pitching.map((p: any) => (
            <tr key={p.playerId}>
              <td>{p.name}</td><td>{p.ip}</td><td>{p.h}</td><td>{p.r}</td>
              <td className={`box-er ${p.erOverridden ? 'overridden' : ''}`}
                  onClick={() => editEr(p)} title="點擊修改自責分">{p.er}</td>
              <td>{p.bb}</td><td>{p.k}</td><td>{p.pitches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
