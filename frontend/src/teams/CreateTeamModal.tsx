import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Field, Input, Select, Modal, useToast } from '../ui'
import { useTeams } from './TeamsProvider'

export default function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('baseball')
  const { reload } = useTeams()
  const toast = useToast()
  const nav = useNavigate()

  async function create() {
    if (!name.trim()) return
    try {
      const t = await api.teams.create({ teamName: name, sportType: sport })
      await reload()
      setName(''); onClose(); toast.show('球隊已建立')
      if (t?.teamId) nav(`/teams/${t.teamId}`)
    } catch { toast.show('建立失敗', 'error') }
  }

  return (
    <Modal open={open} title="建立球隊" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button onClick={create} disabled={!name.trim()}>建立</Button>
      </>}>
      <Field label="球隊名稱">
        <Input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="例如：紅龍隊" />
      </Field>
      <Field label="球種">
        <Select value={sport} onChange={e => setSport(e.target.value)}>
          <option value="baseball">棒球</option>
          <option value="softball_fast">快壘</option>
          <option value="softball_slow">慢壘</option>
          <option value="teeball">樂樂棒球</option>
        </Select>
      </Field>
    </Modal>
  )
}
