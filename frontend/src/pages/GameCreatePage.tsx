import { useEffect, useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Input, Select, useToast } from '../ui'
import './games.css'

export default function GameCreatePage() {
  const { teamId } = useParams()
  const { team } = useOutletContext<{ team: any }>()
  const nav = useNavigate()
  const toast = useToast()
  const [presets, setPresets] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    sportType: 'baseball', matchMode: 'formal', basePresetId: '',
    dhEnabled: false, epAllowed: false, rosterSize: 9, reEntryAllowed: false,
    gameDate: '', homeAway: 'home', opponentName: '', venue: '', weather: '', temperatureC: '',
  })
  const [oppOptions, setOppOptions] = useState<string[]>([])

  useEffect(() => { if (team?.sportType) setForm((f: any) => ({ ...f, sportType: team.sportType })) }, [team])

  useEffect(() => {
    api.rulePresets.list(`?matchMode=${form.matchMode}`).then(setPresets)
  }, [form.matchMode])

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  function applyPreset(id: string) {
    const p = presets.find(x => x.presetId === id)
    if (!p) { set('basePresetId', ''); return }
    setForm((f: any) => ({
      ...f, basePresetId: id, dhEnabled: p.dhAllowed, epAllowed: p.epAllowed,
      rosterSize: p.defaultRosterSize, reEntryAllowed: p.reEntryAllowed,
    }))
  }

  async function onOpponentInput(v: string) {
    set('opponentName', v)
    if (v.trim()) {
      const opts = await api.games.opponents(teamId!, v).catch(() => [])
      setOppOptions(opts.map((o: any) => o.name))
    } else setOppOptions([])
  }

  async function submit() {
    const body: any = {
      sportType: form.sportType, matchMode: form.matchMode,
      basePresetId: form.basePresetId || undefined,
      dhEnabled: form.dhEnabled, epAllowed: form.epAllowed,
      rosterSize: Number(form.rosterSize), reEntryAllowed: form.reEntryAllowed,
      gameDate: form.gameDate, homeAway: form.homeAway,
      opponentName: form.opponentName || undefined,
      venue: form.venue || undefined, weather: form.weather || undefined,
      temperatureC: form.temperatureC === '' ? undefined : Number(form.temperatureC),
    }
    try {
      const g = await api.games.create(teamId!, body)
      nav(`/games/${g.gameId}/lineup`)
    } catch { toast.show('建立失敗：請確認必填欄位（對內賽以外需填對手）。', 'error') }
  }

  return (
    <section>
      <h2>建立比賽</h2>
      <div className="form-grid">
        <label>球種
          <Select value={form.sportType} onChange={e => set('sportType', e.target.value)}>
            <option value="baseball">棒球</option>
            <option value="softball_fast">快壘</option>
            <option value="softball_slow">慢壘</option>
            <option value="teeball">樂樂棒</option>
          </Select>
        </label>
        <label>賽事模式
          <Select value={form.matchMode} onChange={e => set('matchMode', e.target.value)}>
            <option value="formal">正式</option>
            <option value="friendly">友誼</option>
            <option value="intra_squad">對內賽</option>
          </Select>
        </label>
        <label className="full">規則基底（帶入後可改）
          <Select value={form.basePresetId} onChange={e => applyPreset(e.target.value)}>
            <option value="">— 不帶入 —</option>
            {presets.map(p => <option key={p.presetId} value={p.presetId}>{p.label}</option>)}
          </Select>
        </label>
        <div className="full rule-toggles">
          <label><input type="checkbox" checked={form.dhEnabled} onChange={e => set('dhEnabled', e.target.checked)} /> 允許 DH</label>
          <label><input type="checkbox" checked={form.epAllowed} onChange={e => set('epAllowed', e.target.checked)} /> 允許 EP</label>
          <label><input type="checkbox" checked={form.reEntryAllowed} onChange={e => set('reEntryAllowed', e.target.checked)} /> 允許再上場</label>
          <label>人數基準 <input type="number" min={1} value={form.rosterSize} onChange={e => set('rosterSize', e.target.value)} style={{ width: 64 }} /></label>
        </div>
        <label>比賽日期
          <Input type="date" value={form.gameDate} onChange={e => set('gameDate', e.target.value)} />
        </label>
        <label>主/客
          <Select value={form.homeAway} onChange={e => set('homeAway', e.target.value)}>
            <option value="home">主場</option><option value="away">客場</option>
          </Select>
        </label>
        <label className="full autocomplete">對手{form.matchMode !== 'intra_squad' ? '（必填）' : '（可空）'}
          <Input value={form.opponentName} onChange={e => onOpponentInput(e.target.value)} placeholder="對手名稱" />
          {oppOptions.length > 0 && (
            <div className="options">
              {oppOptions.map(o => <div key={o} onClick={() => { set('opponentName', o); setOppOptions([]) }}>{o}</div>)}
            </div>
          )}
        </label>
        <label>地點<Input value={form.venue} onChange={e => set('venue', e.target.value)} /></label>
        <label>天氣<Input value={form.weather} onChange={e => set('weather', e.target.value)} /></label>
        <label>溫度(℃)<Input type="number" value={form.temperatureC} onChange={e => set('temperatureC', e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 16 }}>
        <Button onClick={submit}>建立比賽</Button>
      </div>
    </section>
  )
}
