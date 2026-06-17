import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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
const STATUS_LABELS: Record<string, string> = {
  signed_up: '報名', present: '到場', late: '遲到', absent: '請假', no_show: '放鴿子',
}
const STATUS_KEYS = Object.keys(STATUS_LABELS)

// 守位分群（看板上色用）。出賽守位仍是 P；P 再依球員檔案 primaryPositions 的 SP/RP 細分，
// 路人/無標記→預設投手色（pitcher）。回傳 undefined 代表未填守位、不上色。
const INFIELD = new Set(['1B', '2B', '3B', 'SS'])
const OUTFIELD = new Set(['LF', 'CF', 'RF', 'SF'])
function posGroup(pos: string | undefined, player: any): string | undefined {
  if (!pos) return undefined
  if (pos === 'C') return 'catcher'
  if (INFIELD.has(pos)) return 'infield'
  if (OUTFIELD.has(pos)) return 'outfield'
  if (pos === 'P') {
    const pp: string[] = player?.primaryPositions ?? []
    if (pp.includes('SP')) return 'sp'
    if (pp.includes('RP')) return 'rp'
    return 'pitcher'
  }
  return undefined
}

type Container = 'signup' | 'starter' | 'bench'
type Item = { uid: string; playerId?: string; guestName?: string; status: string; note?: string; fieldPosition?: string }
type Board = Record<Container, Item[]>

let _seq = 0
const uid = () => `it-${_seq++}`
const keyOf = (x: { playerId?: string; guestName?: string }) => x.playerId ? `p:${x.playerId}` : `g:${x.guestName}`
function itemLabel(item: Item, players: any[]) {
  if (item.playerId) {
    const p = players.find(pl => pl.playerId === item.playerId)
    return p ? `${p.displayName}${p.uniformNumber ? ` #${p.uniformNumber}` : ''}` : '球員'
  }
  return item.guestName || '路人'
}

export default function LineupTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [players, setPlayers] = useState<any[]>([])
  const [board, setBoard] = useState<Board>({ signup: [], starter: [], bench: [] })
  const [result, setResult] = useState<{ valid: boolean; violations: { code: string; message: string }[] } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!game) return
    let cancelled = false
    ;(async () => {
      const ps = await api.players.list(game.teamId).catch(() => [])
      const r = await api.roster.get(gameId!).catch(() => ({ slots: [] }))
      const su = await api.signups.get(gameId!).catch(() => ({ signups: [] }))
      if (cancelled) return
      const slots = (r.slots ?? [])
      const starter = slots.filter((s: any) => s.lineupStatus === 'starter')
        .sort((a: any, b: any) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0))
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: 'present', fieldPosition: s.fieldPosition } as Item))
      const bench = slots.filter((s: any) => s.lineupStatus !== 'starter')
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: 'present' } as Item))
      const inLineup = new Set([...starter, ...bench].map(keyOf))
      const signup = (su.signups ?? []).filter((s: any) => !inLineup.has(keyOf(s)))
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: s.status ?? 'signed_up', note: s.note } as Item))
      setPlayers(ps); setBoard({ signup, starter, bench }); setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [gameId])

  const positions = game ? (POSITIONS[game.sportType] ?? POSITIONS.baseball) : []

  function findContainer(id: string): Container | null {
    if (id === 'signup' || id === 'starter' || id === 'bench') return id
    for (const c of ['signup', 'starter', 'bench'] as Container[])
      if (board[c].some(it => it.uid === id)) return c
    return null
  }

  function move(uidStr: string, to: Container, toIndex?: number) {
    setBoard(prev => {
      const from = (['signup', 'starter', 'bench'] as Container[]).find(c => prev[c].some(it => it.uid === uidStr))
      if (!from) return prev
      const item = prev[from].find(it => it.uid === uidStr)!
      const next: Board = { signup: [...prev.signup], starter: [...prev.starter], bench: [...prev.bench] }
      next[from] = next[from].filter(it => it.uid !== uidStr)
      const idx = toIndex == null ? next[to].length : toIndex
      next[to] = [...next[to].slice(0, idx), item, ...next[to].slice(idx)]
      return next
    })
  }

  function onDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }

  // 拖曳過程即時把卡片搬到目標欄（解決「資料過去了但畫面沒過去」）。跨欄移動在這裡發生，
  // onDragEnd 只負責同欄最終排序。
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeUid = active.id as string
    const overId = over.id as string
    const from = findContainer(activeUid)
    const to = findContainer(overId)
    if (!from || !to || from === to) return
    setBoard(prev => {
      const fromItems = prev[from]
      const item = fromItems.find(it => it.uid === activeUid)
      if (!item) return prev
      const toItems = prev[to]
      const overIdx = overId === to ? toItems.length : toItems.findIndex(it => it.uid === overId)
      const idx = overIdx < 0 ? toItems.length : overIdx
      const next: Board = { signup: [...prev.signup], starter: [...prev.starter], bench: [...prev.bench] }
      next[from] = fromItems.filter(it => it.uid !== activeUid)
      next[to] = [...toItems.slice(0, idx), item, ...toItems.slice(idx)]
      return next
    })
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    // 跨欄已在 onDragOver 完成，這裡 from 通常已等於 to；只處理同欄重排。
    const to = findContainer(over.id as string)
    const from = findContainer(active.id as string)
    if (!from || !to || from !== to) return
    setBoard(prev => {
      const items = prev[to]
      const oldIdx = items.findIndex(it => it.uid === active.id)
      const newIdx = over.id === to ? items.length - 1 : items.findIndex(it => it.uid === over.id)
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev
      return { ...prev, [to]: arrayMove(items, oldIdx, newIdx) }
    })
  }

  function update(uidStr: string, patch: Partial<Item>) {
    setBoard(prev => {
      const next: Board = { signup: [...prev.signup], starter: [...prev.starter], bench: [...prev.bench] }
      for (const c of ['signup', 'starter', 'bench'] as Container[])
        next[c] = next[c].map(it => it.uid === uidStr ? { ...it, ...patch } : it)
      return next
    })
  }
  function remove(uidStr: string) {
    setBoard(prev => ({
      signup: prev.signup.filter(it => it.uid !== uidStr),
      starter: prev.starter.filter(it => it.uid !== uidStr),
      bench: prev.bench.filter(it => it.uid !== uidStr),
    }))
  }
  function addSignup() {
    setBoard(prev => ({ ...prev, signup: [...prev.signup, { uid: uid(), guestName: '', status: 'signed_up' }] }))
  }
  function addDirect(to: Container) {
    setBoard(prev => ({ ...prev, [to]: [...prev[to], { uid: uid(), guestName: '', status: 'present' }] }))
  }

  function buildBodies() {
    const PLACED_SORT_OFFSET = 1000
    const src = (it: Item) => ({
      playerId: it.playerId || undefined,
      guestName: it.playerId ? undefined : (it.guestName || undefined),
    })
    const isEmpty = (it: Item) => { const f = src(it); return !f.playerId && !f.guestName }

    const starterSlots = board.starter.filter(it => !isEmpty(it)).map((it, i) => ({
      ...src(it), battingOrder: i + 1, fieldPosition: it.fieldPosition || undefined, lineupStatus: 'starter',
    }))
    const benchSlots = board.bench.filter(it => !isEmpty(it)).map(it => ({ ...src(it), lineupStatus: 'bench' }))
    const slots = [...starterSlots, ...benchSlots]

    // 報名清單 = 候補池 + 已排者（記為 present）；以 keyOf 去重（已排者優先），並丟掉未填的空白卡。
    const byKey = new Map<string, any>()
    board.signup.filter(it => !isEmpty(it)).forEach((it, i) =>
      byKey.set(keyOf(it), { ...src(it), status: it.status, note: it.note || undefined, sortIndex: i }))
    ;[...board.starter, ...board.bench].filter(it => !isEmpty(it)).forEach((it, i) =>
      byKey.set(keyOf(it), { ...src(it), status: 'present', sortIndex: PLACED_SORT_OFFSET + i }))
    const signups = [...byKey.values()]

    return { rosterBody: { slots }, signupBody: { signups } }
  }

  async function save() {
    const { rosterBody, signupBody } = buildBodies()
    try {
      await api.signups.put(gameId!, signupBody)
      await api.roster.put(gameId!, rosterBody)
      toast.show('已儲存（草稿）'); setResult(null)
    } catch { toast.show('儲存失敗：每張卡需選一名球員或填一位路人。', 'error') }
  }
  async function validate() { await save(); setResult(await api.roster.validate(gameId!)) }
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

  if (!game) return null
  const starters = board.starter
  // #3 同球員去重：已被任一張卡選走的 playerId；Card 下拉只顯示未被選走者（外加自己這張卡已選的）。
  const usedPlayerIds = new Set(
    [...board.signup, ...board.starter, ...board.bench]
      .map(it => it.playerId).filter(Boolean) as string[],
  )
  // #1 拖曳浮層內容：目前被拖的卡片。
  const activeItem = activeId
    ? [...board.signup, ...board.starter, ...board.bench].find(it => it.uid === activeId) ?? null
    : null

  return (
    <section>
      {!loaded && <p role="status">載入中…</p>}
      {loaded && (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="roster-board">
            {/* 報名清單 */}
            <Column id="signup" title="報名清單" hint="不驗證 · 候補池" items={board.signup}>
              {board.signup.map(it => (
                <Card key={it.uid} item={it} players={players} usedPlayerIds={usedPlayerIds} onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                      onGuest={(n) => update(it.uid, { guestName: n })}>
                  <select aria-label="狀態" value={it.status} onChange={e => update(it.uid, { status: e.target.value })}>
                    {STATUS_KEYS.map(k => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
                  </select>
                  <Button variant="ghost" onClick={() => move(it.uid, 'starter')}>→先發</Button>
                  <Button variant="ghost" onClick={() => move(it.uid, 'bench')}>→替補</Button>
                  <Button variant="ghost" onClick={() => remove(it.uid)}>移除</Button>
                </Card>
              ))}
              <Button variant="ghost" onClick={addSignup}>＋ 報名 / 加候補</Button>
            </Column>

            {/* 出賽名單 */}
            <div className="roster-lineup">
              <Column id="starter" title="先發" hint="欄內上下拖改打序" items={board.starter}>
                {board.starter.map((it, i) => (
                  <Card key={it.uid} item={it} players={players} usedPlayerIds={usedPlayerIds} order={i + 1}
                        onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                        onGuest={(n) => update(it.uid, { guestName: n })}>
                    <select aria-label="守位" className="pos-select"
                            data-pos-group={posGroup(it.fieldPosition, players.find(p => p.playerId === it.playerId))}
                            value={it.fieldPosition ?? ''} onChange={e => update(it.uid, { fieldPosition: e.target.value || undefined })}>
                      <option value="">（守位）</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Button variant="ghost" onClick={() => move(it.uid, 'bench')}>→替補</Button>
                    <Button variant="ghost" onClick={() => move(it.uid, 'signup')}>↩退回報名</Button>
                  </Card>
                ))}
                <Button variant="ghost" onClick={() => addDirect('starter')}>＋ 直接加入先發</Button>
              </Column>

              <Column id="bench" title="替補" hint="已到、待命" items={board.bench}>
                {board.bench.map(it => (
                  <Card key={it.uid} item={it} players={players} usedPlayerIds={usedPlayerIds}
                        onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                        onGuest={(n) => update(it.uid, { guestName: n })}>
                    <Button variant="ghost" onClick={() => move(it.uid, 'starter')}>→先發</Button>
                    <Button variant="ghost" onClick={() => move(it.uid, 'signup')}>↩退回報名</Button>
                    <Button variant="ghost" onClick={() => remove(it.uid)}>移除</Button>
                  </Card>
                ))}
                <Button variant="ghost" onClick={() => addDirect('bench')}>＋ 直接加入替補</Button>
              </Column>
            </div>
          </div>

          <div className="inline-form" style={{ marginTop: 12 }}>
            <span role="status" className="muted">出賽 {starters.length + board.bench.length} 人（先發 {starters.length} / 替補 {board.bench.length}）</span>
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

          <DragOverlay>
            {activeItem ? (
              <div className="roster-card roster-card--overlay">
                <span className="drag-handle">⠿</span>
                <span>{itemLabel(activeItem, players)}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  )
}

function Column({ id, title, hint, items, children }:
  { id: Container; title: string; hint: string; items: Item[]; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div className="roster-col" ref={setNodeRef} data-col={id}>
      <div className="roster-col-head"><b>{title}</b><span className="muted">{hint}</span></div>
      <SortableContext items={items.map(it => it.uid)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  )
}

function Card({ item, players, usedPlayerIds, order, onPlayer, onGuest, children }:
  { item: Item; players: any[]; usedPlayerIds: Set<string>; order?: number; onPlayer: (pid?: string) => void; onGuest: (n: string) => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }
  // #3：別張卡已選走的球員不顯示在此下拉；自己這張卡已選者仍保留（否則選不回去）。
  const options = players.filter(p => !usedPlayerIds.has(p.playerId) || p.playerId === item.playerId)
  return (
    <div ref={setNodeRef} style={style} className="roster-card" data-card={keyOf(item)}>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="拖拉" title="拖拉">⠿</span>
      {order != null && <b className="bo">{order}</b>}
      <select aria-label="球員" value={item.playerId ?? '__guest'}
              onChange={e => onPlayer(e.target.value === '__guest' ? undefined : e.target.value)}>
        <option value="__guest">路人…</option>
        {options.map(p => <option key={p.playerId} value={p.playerId}>{p.displayName}{p.uniformNumber ? ` #${p.uniformNumber}` : ''}</option>)}
      </select>
      {!item.playerId && <input placeholder="路人名稱" value={item.guestName ?? ''} onChange={e => onGuest(e.target.value)} />}
      {children}
    </div>
  )
}
