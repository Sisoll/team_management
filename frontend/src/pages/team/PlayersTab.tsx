import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Input, Modal, Skeleton, useToast } from '../../ui'
import '../teams.css'

export default function PlayersTab() {
  const teamId = useParams().teamId!
  const [players, setPlayers] = useState<any[] | null>(null)
  const [name, setName] = useState(''); const [num, setNum] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [editing, setEditing] = useState<any>(null); const [editNum, setEditNum] = useState('')
  const [archiving, setArchiving] = useState<any>(null)
  const toast = useToast()
  const numErr = num && !/^\d{1,10}$/.test(num) ? '背號只能是數字' : ''

  const load = () => teamId && api.players.list(teamId, includeArchived ? '?includeArchived=true' : '').then(setPlayers)
  useEffect(() => { setPlayers(null); load() }, [teamId, includeArchived])

  async function addPlayer() {
    if (!name.trim() || numErr) return
    try { await api.players.create(teamId, { displayName: name, uniformNumber: num || undefined }); setName(''); setNum(''); toast.show('球員已新增'); load() }
    catch { toast.show('新增失敗', 'error') }
  }
  async function saveNumber() {
    try { await api.players.update(teamId, editing.playerId, { uniformNumber: editNum || undefined }); setEditing(null); toast.show('背號已更新'); load() }
    catch { toast.show('更新失敗', 'error') }
  }
  async function doArchive() {
    try { await api.players.remove(teamId, archiving.playerId); setArchiving(null); toast.show('球員已封存'); load() }
    catch { toast.show('封存失敗', 'error') }
  }

  return (
    <section>
      <div className="inline-form">
        <Input placeholder="球員名稱" value={name} onChange={e => setName(e.target.value)} />
        <Input placeholder="背號" inputMode="numeric" value={num} onChange={e => setNum(e.target.value)} />
        <Button onClick={addPlayer} disabled={!!numErr}>新增球員</Button>
        <label style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} /> 顯示已封存
        </label>
      </div>
      {numErr && <p className="error" role="alert">{numErr}</p>}
      {players === null ? <Skeleton rows={4} /> : (
        <table className="table">
          <thead><tr><th>背號</th><th>名稱</th><th>守位</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {players.map(p => (
              <tr key={p.playerId}>
                <td>{p.uniformNumber ?? '—'}</td><td>{p.displayName}</td>
                <td>{p.primaryPositions.join(', ') || '—'}</td><td>{p.rosterStatus}</td>
                <td className="row-actions">
                  <Button variant="ghost" onClick={() => { setEditing(p); setEditNum(p.uniformNumber ?? '') }}>改背號</Button>
                  {p.rosterStatus !== 'archived' && <Button variant="ghost" onClick={() => setArchiving(p)}>封存</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!editing} title={`改背號（${editing?.displayName ?? ''}）`} onClose={() => setEditing(null)}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>取消</Button><Button onClick={saveNumber}>儲存</Button></>}>
        <Input placeholder="背號" inputMode="numeric" value={editNum} onChange={e => setEditNum(e.target.value)} autoFocus />
      </Modal>
      <Modal open={!!archiving} title="封存球員" onClose={() => setArchiving(null)}
        footer={<><Button variant="ghost" onClick={() => setArchiving(null)}>取消</Button><Button variant="danger" onClick={doArchive}>封存</Button></>}>
        確定要封存 {archiving?.displayName}？
      </Modal>
    </section>
  )
}
