# Web 外殼 + 視覺 reskin + 元件 + 微互動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現有薄切片前端重組成有外殼/分頁導覽的 web app，並全面 reskin、加共用元件與微互動，不動後端。

**Architecture:** 新增 `src/ui/`（無狀態元件庫）與 `src/layout/`（AppShell / 巢狀 layout route）。react-router 改巢狀，`TeamLayout`/`GameLayout` 用 `<Outlet/>` 掛分頁；未做分頁以 `Placeholder`「即將推出」呈現。視覺走 brainstorming 方向 C 結構 + 暖米色票。

**Tech Stack:** React 18 / TypeScript 5.4 / react-router-dom 6.30 / Vite 5 / Playwright（唯一測試層，無 vitest）。

**設計來源：** `docs/superpowers/specs/2026-06-10-ui-web-shell-polish-design.md`

---

## 環境 / 執行慣例（接手者必讀）

- 工作目錄 `frontend/`。**型別檢查＋建置**：`npm run build`（= `tsc && vite build`）。**E2E**：`npx playwright test`（需後端 5199 + DB 已起；前端 dev server Playwright 會自起於 5200，`reuseExistingServer:true`）。
- 介面語言 **繁體中文（zh-Hant）**。**一律吃 tokens，禁止寫死顏色/字體**。
- 跑多個 subagent 易殘留 `node.exe` 殭屍咬住 `.vite` 致 `EPERM` → 收尾或遇 EPERM 時 `taskkill //F //IM node.exe` + 刪 `frontend/.vite`。
- fast-mode：subagent 只寫檔，**build/typecheck/E2E 由 controller 集中跑**（不要每個 subagent 自起 dev server 搏鬥）。
- **不主動 commit**（依使用者規則）；下方各任務的 commit step 為「建議切點」，由使用者決定是否實際提交。commit 訊息結尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

## File Structure

**新增 `src/ui/`（純元件，co-located CSS）：**
- `Button.tsx`/`Button.css` — primary/ghost/danger，統一 focus/hover/disabled（吸收現有 `.btn`）
- `Card.tsx`/`Card.css` — 區塊/卡片容器，可點
- `Field.tsx`/`Field.css` — label + input/select + 錯誤訊息槽
- `Chip.tsx`/`Chip.css` — Chip 與 StatusBadge（比賽狀態色）
- `EmptyState.tsx`/`EmptyState.css`
- `Skeleton.tsx`/`Skeleton.css` — 列/卡片骨架
- `Modal.tsx`/`Modal.css` — 取代原生 `prompt/confirm`；焦點鎖、Esc、遮罩
- `toast.tsx`/`Toast.css` — `ToastProvider` + `useToast()`
- `index.ts` — barrel export

**新增 `src/layout/`：**
- `AppShell.tsx`/`AppShell.css` — 頂欄（品牌＋帳號選單）+ children
- `TabBar.tsx`/`TabBar.css` — 分頁列（active / disabled「即將推出」）
- `Breadcrumb.tsx`/`Breadcrumb.css`
- `Placeholder.tsx` — 佔位分頁畫面
- `TeamLayout.tsx` — 載入球隊、麵包屑、身分 chip、球隊 TabBar、`<Outlet/>`
- `GameLayout.tsx` — 載入比賽、麵包屑、比賽 TabBar、`<Outlet/>`

**修改：**
- `src/tokens.css` — 新增 spacing/mono/focus-ring/transition tokens
- `src/main.tsx` — 包 `ToastProvider`
- `src/App.tsx` — 巢狀路由
- `src/pages/LoginPage.tsx`、`TeamsPage.tsx`、`GameCreatePage.tsx` — 套元件
- 拆 `src/pages/TeamPage.tsx` → `pages/team/PlayersTab.tsx` + `pages/team/GamesTab.tsx`
- 拆 `src/pages/GamePage.tsx` → `pages/game/InfoTab.tsx` + `pages/game/LineupTab.tsx`
- `e2e/auth.spec.ts`、`e2e/team-player.spec.ts`、`e2e/m2-games-lineup.spec.ts` — 對應新導覽
- 新增 `e2e/navigation.spec.ts`

---

## Phase 0 — Tokens 基礎

### Task 0.1: 擴充 design tokens

**Files:** Modify `frontend/src/tokens.css`

- [ ] **Step 1: 在 `:root` 末加入新 tokens**（接在 `--font-sans` 之後）

```css
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, "Noto Sans Mono", monospace;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
  --focus-ring: 0 0 0 3px var(--accent-soft);
  --transition: 0.15s ease;
  --topbar-bg: var(--accent-strong);
  --topbar-fg: #fffdf7;
```

- [ ] **Step 2: typecheck**

Run: `cd frontend && npm run build`
Expected: build 成功（無 TS 錯）。

- [ ] **Step 3: Commit（建議切點）**

```bash
git add frontend/src/tokens.css
git commit -m "feat(ui): extend design tokens (spacing/mono/focus/transition)"
```

---

## Phase 1 — UI 元件庫（`src/ui/`）

> 所有元件吃 tokens；對外 props 簡單；含基本鍵盤/無障礙。每個元件完成後 controller 跑一次 `npm run build` 確認型別。

### Task 1.1: Button

**Files:** Create `frontend/src/ui/Button.tsx`, `frontend/src/ui/Button.css`

- [ ] **Step 1: 寫 `Button.tsx`**

```tsx
import './Button.css'
type Variant = 'primary' | 'ghost' | 'danger'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return <button className={`ui-btn ui-btn-${variant} ${className}`} {...rest} />
}
```

- [ ] **Step 2: 寫 `Button.css`**（從 `LoginPage.css` 的 `.btn*` 移植，改前綴 `ui-btn`，吃 focus token）

```css
.ui-btn { padding: 10px 16px; border: 1px solid transparent; border-radius: var(--radius-sm);
  font-weight: 600; cursor: pointer; transition: background var(--transition), border-color var(--transition), opacity var(--transition), transform 0.05s; }
.ui-btn:active { transform: translateY(1px); }
.ui-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ui-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ui-btn-primary { background: var(--accent); color: var(--surface); }
.ui-btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
.ui-btn-ghost { background: transparent; border-color: var(--accent); color: var(--accent); }
.ui-btn-ghost:hover:not(:disabled) { background: var(--accent-soft); }
.ui-btn-danger { background: var(--danger); color: var(--surface); }
.ui-btn-danger:hover:not(:disabled) { filter: brightness(0.94); }
```

- [ ] **Step 3: typecheck** — `cd frontend && npm run build` → 成功。

### Task 1.2: Card

**Files:** Create `frontend/src/ui/Card.tsx`, `Card.css`

- [ ] **Step 1: `Card.tsx`**

```tsx
import './Card.css'
type Props = React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
export default function Card({ interactive, className = '', ...rest }: Props) {
  return <div className={`ui-card ${interactive ? 'ui-card-interactive' : ''} ${className}`} {...rest} />
}
```

- [ ] **Step 2: `Card.css`**

```css
.ui-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  box-shadow: var(--shadow); padding: var(--space-4); }
.ui-card-interactive { cursor: pointer; transition: transform var(--transition), background var(--transition); }
.ui-card-interactive:hover { transform: translateY(-2px); background: var(--surface-alt); }
```

### Task 1.3: Field（label + input/select + 錯誤）

**Files:** Create `frontend/src/ui/Field.tsx`, `Field.css`

- [ ] **Step 1: `Field.tsx`**

```tsx
import './Field.css'
type FieldProps = { label?: string; error?: string; className?: string; children: React.ReactNode }
export function Field({ label, error, className = '', children }: FieldProps) {
  return (
    <label className={`ui-field ${className}`}>
      {label && <span className="ui-field-label">{label}</span>}
      {children}
      {error && <span className="ui-field-error" role="alert">{error}</span>}
    </label>
  )
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input ${props.className ?? ''}`} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ui-input ${props.className ?? ''}`} />
}
```

- [ ] **Step 2: `Field.css`**（移植登入頁 `.auth-input` 的 focus 手法）

```css
.ui-field { display: grid; gap: var(--space-1); font-size: 14px; }
.ui-field-label { color: var(--muted); }
.ui-field-error { color: var(--danger); font-size: 13px; }
.ui-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg); color: var(--text);
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition); }
.ui-input::placeholder { color: var(--muted); }
.ui-input:focus { outline: none; border-color: var(--accent); background: var(--surface); box-shadow: var(--focus-ring); }
```

### Task 1.4: Chip / StatusBadge

**Files:** Create `frontend/src/ui/Chip.tsx`, `Chip.css`

- [ ] **Step 1: `Chip.tsx`**（比賽狀態 → 顏色；沿用既有 `STATUS_LABEL`）

```tsx
import './Chip.css'
export function Chip({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'warning' | 'info' | 'muted' }) {
  return <span className={`ui-chip ui-chip-${tone}`}>{children}</span>
}
const GAME_STATUS: Record<string, { label: string; tone: 'muted' | 'info' | 'accent' }> = {
  draft: { label: '草稿', tone: 'muted' },
  scheduled: { label: '已排定', tone: 'info' },
  lineup_confirmed: { label: '名單已確認', tone: 'accent' },
}
export function StatusBadge({ status }: { status: string }) {
  const s = GAME_STATUS[status] ?? { label: status, tone: 'muted' as const }
  return <Chip tone={s.tone}>{s.label}</Chip>
}
```

- [ ] **Step 2: `Chip.css`**

```css
.ui-chip { display: inline-block; padding: 2px 10px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; }
.ui-chip-accent { background: var(--accent-soft); color: var(--accent-strong); }
.ui-chip-warning { background: var(--warning-soft); color: var(--warning); }
.ui-chip-info { background: var(--info-soft); color: var(--info); }
.ui-chip-muted { background: var(--surface-alt); color: var(--muted); }
```

### Task 1.5: EmptyState

**Files:** Create `frontend/src/ui/EmptyState.tsx`, `EmptyState.css`

- [ ] **Step 1: `EmptyState.tsx`**

```tsx
import './EmptyState.css'
export default function EmptyState({ icon = '📭', children }: { icon?: string; children: React.ReactNode }) {
  return <div className="ui-empty"><div className="ui-empty-icon" aria-hidden="true">{icon}</div><p>{children}</p></div>
}
```

- [ ] **Step 2: `EmptyState.css`**

```css
.ui-empty { text-align: center; color: var(--muted); padding: var(--space-6) var(--space-4); }
.ui-empty-icon { font-size: 32px; margin-bottom: var(--space-2); }
```

### Task 1.6: Skeleton

**Files:** Create `frontend/src/ui/Skeleton.tsx`, `Skeleton.css`

- [ ] **Step 1: `Skeleton.tsx`**

```tsx
import './Skeleton.css'
export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="ui-skeleton" aria-busy="true" aria-label="載入中">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="ui-skeleton-row" />)}
  </div>
}
```

- [ ] **Step 2: `Skeleton.css`**

```css
.ui-skeleton { display: grid; gap: var(--space-2); }
.ui-skeleton-row { height: 40px; border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--surface-alt) 25%, var(--bg) 37%, var(--surface-alt) 63%);
  background-size: 400% 100%; animation: ui-shimmer 1.4s ease infinite; }
@keyframes ui-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
```

### Task 1.7: Modal（取代 prompt/confirm）

**Files:** Create `frontend/src/ui/Modal.tsx`, `Modal.css`

- [ ] **Step 1: `Modal.tsx`**（Esc 關閉、點遮罩關閉、開啟時聚焦面板；`role="dialog"`/`aria-modal`）

```tsx
import { useEffect, useRef } from 'react'
import './Modal.css'
type Props = { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }
export default function Modal({ open, title, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title}
        tabIndex={-1} ref={panelRef} onClick={e => e.stopPropagation()}>
        {title && <h2 className="ui-modal-title">{title}</h2>}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `Modal.css`**

```css
.ui-modal-overlay { position: fixed; inset: 0; background: rgba(35, 28, 19, 0.45);
  display: grid; place-items: center; padding: var(--space-4); z-index: 50; }
.ui-modal { width: min(100%, 420px); background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: var(--space-5); }
.ui-modal:focus { outline: none; }
.ui-modal-title { margin: 0 0 var(--space-3); color: var(--accent-strong); font-size: 18px; }
.ui-modal-body { display: grid; gap: var(--space-3); }
.ui-modal-footer { display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-4); }
```

### Task 1.8: Toast（Provider + useToast）

**Files:** Create `frontend/src/ui/toast.tsx`, `Toast.css`; Modify `frontend/src/main.tsx`

- [ ] **Step 1: `toast.tsx`**

```tsx
import { createContext, useCallback, useContext, useState } from 'react'
import './Toast.css'
type Toast = { id: number; tone: 'success' | 'error'; text: string }
type Ctx = { show: (text: string, tone?: 'success' | 'error') => void }
const ToastCtx = createContext<Ctx>({ show: () => {} })
export const useToast = () => useContext(ToastCtx)
let _id = 0
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = ++_id
    setItems(s => [...s, { id, tone, text }])
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="ui-toast-stack" role="status" aria-live="polite">
        {items.map(t => <div key={t.id} className={`ui-toast ui-toast-${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
```

- [ ] **Step 2: `Toast.css`**

```css
.ui-toast-stack { position: fixed; right: var(--space-4); bottom: var(--space-4); display: grid; gap: var(--space-2); z-index: 60; }
.ui-toast { padding: 10px 14px; border-radius: var(--radius-sm); box-shadow: var(--shadow); font-size: 14px;
  animation: ui-toast-in var(--transition); }
.ui-toast-success { background: var(--accent-soft); color: var(--accent-strong); }
.ui-toast-error { background: var(--danger-soft); color: var(--danger); }
@keyframes ui-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 3: 在 `main.tsx` 包 `ToastProvider`**（在 `<BrowserRouter>` 內、`<App/>` 外）

```tsx
import { ToastProvider } from './ui/toast'
// ...
  <BrowserRouter>
    <ToastProvider>
      <App />
    </ToastProvider>
  </BrowserRouter>
```

- [ ] **Step 4: typecheck** — `cd frontend && npm run build` → 成功。

### Task 1.9: barrel `index.ts`

**Files:** Create `frontend/src/ui/index.ts`

- [ ] **Step 1:**

```ts
export { default as Button } from './Button'
export { default as Card } from './Card'
export { Field, Input, Select } from './Field'
export { Chip, StatusBadge } from './Chip'
export { default as EmptyState } from './EmptyState'
export { default as Skeleton } from './Skeleton'
export { default as Modal } from './Modal'
export { ToastProvider, useToast } from './toast'
```

- [ ] **Step 2: Commit（建議切點）**

```bash
git add frontend/src/ui frontend/src/main.tsx
git commit -m "feat(ui): add shared component library (button/card/field/modal/toast/...)"
```

---

## Phase 2 — App 外殼 + Layouts + 路由

### Task 2.1: AppShell（頂欄）

**Files:** Create `frontend/src/layout/AppShell.tsx`, `AppShell.css`

- [ ] **Step 1: `AppShell.tsx`**（品牌點擊回首頁；帳號選單下拉，含登出）

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AppShell.css'
export default function AppShell({ userName, onLogout, children }:
  { userName: string; onLogout: () => void; children: React.ReactNode }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button className="app-brand" onClick={() => nav('/')}>⚾ 紀錄台</button>
        <div className="app-account">
          <button className="app-account-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}>
            👤 {userName} ▾
          </button>
          {open && (
            <div className="app-account-menu" role="menu">
              <button role="menuitem" onClick={onLogout}>登出</button>
            </div>
          )}
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: `AppShell.css`**

```css
.app-topbar { background: var(--topbar-bg); color: var(--topbar-fg); display: flex; align-items: center;
  justify-content: space-between; padding: 0 var(--space-4); height: 52px; }
.app-brand { background: none; border: none; color: var(--topbar-fg); font-weight: 700; font-size: 16px; cursor: pointer; }
.app-account { position: relative; }
.app-account-btn { background: none; border: none; color: var(--topbar-fg); cursor: pointer; font-size: 14px; }
.app-account-menu { position: absolute; right: 0; top: 100%; margin-top: var(--space-1); background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow); min-width: 120px; overflow: hidden; }
.app-account-menu button { display: block; width: 100%; text-align: left; padding: 10px 14px; background: none; border: none;
  cursor: pointer; color: var(--text); }
.app-account-menu button:hover { background: var(--surface-alt); }
.app-content { max-width: 860px; margin: 0 auto; padding: var(--space-5) var(--space-4); }
```

### Task 2.2: TabBar（含 disabled「即將推出」）

**Files:** Create `frontend/src/layout/TabBar.tsx`, `TabBar.css`

- [ ] **Step 1: `TabBar.tsx`**（用 react-router `NavLink`；disabled item 不導頁、顯示 tooltip 文字）

```tsx
import { NavLink } from 'react-router-dom'
import './TabBar.css'
export type Tab = { to: string; label: string; soon?: boolean }
export default function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="tabbar">
      {tabs.map(t => t.soon
        ? <span key={t.label} className="tab tab-soon" title="即將推出" aria-disabled="true">{t.label}<em>即將推出</em></span>
        : <NavLink key={t.label} to={t.to} end className={({ isActive }) => `tab ${isActive ? 'tab-on' : ''}`}>{t.label}</NavLink>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: `TabBar.css`**

```css
.tabbar { display: flex; gap: var(--space-2); flex-wrap: wrap; border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-2); margin-bottom: var(--space-4); }
.tab { padding: 6px 12px; border-radius: var(--radius-sm); font-size: 14px; color: var(--muted); background: var(--surface-alt); }
.tab-on { background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }
.tab-soon { opacity: 0.5; cursor: not-allowed; display: inline-flex; align-items: baseline; gap: 4px; }
.tab-soon em { font-size: 10px; font-style: normal; }
```

### Task 2.3: Breadcrumb

**Files:** Create `frontend/src/layout/Breadcrumb.tsx`, `Breadcrumb.css`

- [ ] **Step 1: `Breadcrumb.tsx`**

```tsx
import { Link } from 'react-router-dom'
import './Breadcrumb.css'
export type Crumb = { label: string; to?: string }
export default function Breadcrumb({ items, trailing }: { items: Crumb[]; trailing?: React.ReactNode }) {
  return (
    <div className="crumbs">
      {items.map((c, i) => (
        <span key={i} className="crumb">
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="crumb-current">{c.label}</span>}
          {i < items.length - 1 && <span className="crumb-sep">›</span>}
        </span>
      ))}
      {trailing && <span className="crumb-trailing">{trailing}</span>}
    </div>
  )
}
```

- [ ] **Step 2: `Breadcrumb.css`**

```css
.crumbs { display: flex; align-items: center; gap: var(--space-2); font-size: 14px; color: var(--muted); margin-bottom: var(--space-3); }
.crumb-current { color: var(--accent-strong); font-weight: 600; }
.crumb-sep { opacity: 0.5; margin: 0 var(--space-1); }
.crumb-trailing { margin-left: auto; }
```

### Task 2.4: Placeholder 佔位頁

**Files:** Create `frontend/src/layout/Placeholder.tsx`

- [ ] **Step 1:**

```tsx
import EmptyState from '../ui/EmptyState'
export default function Placeholder({ name }: { name: string }) {
  return <EmptyState icon="🚧">「{name}」即將推出</EmptyState>
}
```

### Task 2.5: TeamLayout

**Files:** Create `frontend/src/layout/TeamLayout.tsx`

說明：載入球隊基本資料 → 麵包屑 `我的球隊 › <隊名>` + 身分 chip（用 `team.myRoles`，無則顯示「成員」）+ 球隊 TabBar + `<Outlet context={{ team }}/>`。分頁路徑相對於 `/teams/:teamId`。

- [ ] **Step 1: `TeamLayout.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumb from './Breadcrumb'
import TabBar, { Tab } from './TabBar'
import { Chip } from '../ui'

export default function TeamLayout() {
  const { teamId } = useParams()
  const nav = useNavigate()
  const [team, setTeam] = useState<any>(null)
  useEffect(() => { api.teams.get(teamId!).then(setTeam).catch(() => nav('/')) }, [teamId])

  const base = `/teams/${teamId}`
  const tabs: Tab[] = [
    { to: `${base}/overview`, label: '總覽', soon: true },
    { to: `${base}/players`, label: '球員' },
    { to: `${base}/games`, label: '比賽' },
    { to: `${base}/calendar`, label: '行事曆', soon: true },
    { to: `${base}/stats`, label: '統計', soon: true },
    { to: `${base}/settings`, label: '設定', soon: true },
  ]
  const role = team?.myRoles?.[0] ?? '成員'
  return (
    <>
      <Breadcrumb items={[{ label: '我的球隊', to: '/' }, { label: team?.teamName ?? '…' }]}
        trailing={<Chip tone="accent">你的身分：{role}</Chip>} />
      <TabBar tabs={tabs} />
      <Outlet context={{ team }} />
    </>
  )
}
```

### Task 2.6: GameLayout

**Files:** Create `frontend/src/layout/GameLayout.tsx`

說明：載入比賽 → 麵包屑 `我的球隊 › <隊名> › <對手/隊內對抗>` + 比賽狀態 badge + 比賽 TabBar + `<Outlet context={{ game, reload }}/>`。需先取 game 再取 team 名稱（game 有 `teamId`）。

- [ ] **Step 1: `GameLayout.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumb from './Breadcrumb'
import TabBar, { Tab } from './TabBar'
import { StatusBadge } from '../ui'

export default function GameLayout() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const reload = useCallback(() => {
    api.games.get(gameId!).then(async (g: any) => {
      setGame(g)
      setTeam(await api.teams.get(g.teamId).catch(() => null))
    }).catch(() => nav('/'))
  }, [gameId, nav])
  useEffect(() => { reload() }, [reload])

  const base = `/games/${gameId}`
  const tabs: Tab[] = [
    { to: `${base}/info`, label: '資訊' },
    { to: `${base}/lineup`, label: '出賽名單' },
    { to: `${base}/record`, label: '記錄', soon: true },
    { to: `${base}/scoreboard`, label: '計分板', soon: true },
    { to: `${base}/box`, label: '數據', soon: true },
    { to: `${base}/timeline`, label: '時間線', soon: true },
  ]
  const title = game ? (game.opponentName ?? '隊內對抗') : '…'
  return (
    <>
      <Breadcrumb
        items={[{ label: '我的球隊', to: '/' },
          { label: team?.teamName ?? '球隊', to: game ? `/teams/${game.teamId}/games` : '/' },
          { label: title }]}
        trailing={game && <StatusBadge status={game.gameStatus} />} />
      <TabBar tabs={tabs} />
      <Outlet context={{ game, reload }} />
    </>
  )
}
```

### Task 2.7: 重寫 `App.tsx` 巢狀路由

**Files:** Modify `frontend/src/App.tsx`

說明：`AppShell` 包整個已登入區；巢狀 `TeamLayout`/`GameLayout`；index 轉址到預設分頁。佔位分頁直接渲染 `<Placeholder/>`（不需各自檔案）。

- [ ] **Step 1: 改 `App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api, getToken, clearToken } from './api/client'
import AppShell from './layout/AppShell'
import TeamLayout from './layout/TeamLayout'
import GameLayout from './layout/GameLayout'
import Placeholder from './layout/Placeholder'
import LoginPage from './pages/LoginPage'
import TeamsPage from './pages/TeamsPage'
import PlayersTab from './pages/team/PlayersTab'
import GamesTab from './pages/team/GamesTab'
import GameCreatePage from './pages/GameCreatePage'
import InfoTab from './pages/game/InfoTab'
import LineupTab from './pages/game/LineupTab'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const load = () => api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true))
  useEffect(() => { if (getToken()) load(); else setReady(true) }, [])
  function logout() { clearToken(); setMe(null) }
  if (!ready) return null
  if (!me) return <LoginPage onAuthed={load} />
  return (
    <AppShell userName={me.displayName} onLogout={logout}>
      <Routes>
        <Route path="/" element={<TeamsPage />} />
        <Route path="/teams/:teamId" element={<TeamLayout />}>
          <Route index element={<Navigate to="players" replace />} />
          <Route path="players" element={<PlayersTab />} />
          <Route path="games" element={<GamesTab />} />
          <Route path="games/new" element={<GameCreatePage />} />
          <Route path="overview" element={<Placeholder name="總覽" />} />
          <Route path="calendar" element={<Placeholder name="行事曆" />} />
          <Route path="stats" element={<Placeholder name="統計" />} />
          <Route path="settings" element={<Placeholder name="設定" />} />
        </Route>
        <Route path="/games/:gameId" element={<GameLayout />}>
          <Route index element={<Navigate to="lineup" replace />} />
          <Route path="info" element={<InfoTab />} />
          <Route path="lineup" element={<LineupTab />} />
          <Route path="record" element={<Placeholder name="記錄" />} />
          <Route path="scoreboard" element={<Placeholder name="計分板" />} />
          <Route path="box" element={<Placeholder name="數據" />} />
          <Route path="timeline" element={<Placeholder name="時間線" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
```

> ⚠️ 此 step 會引用尚未建立的 `TeamsPage`（改版）、`PlayersTab`、`GamesTab`、`InfoTab`、`LineupTab` → typecheck 會失敗，**直到 Phase 3 完成才會綠**。Phase 2 結束**先不跑** `npm run build`；Phase 3 各任務逐一補齊後再驗。若要中途驗證，可暫時把未建頁面以 inline stub 取代。

- [ ] **Step 2: Commit（建議切點，Phase 3 後）** — 與 Phase 3 一起提交。

---

## Phase 3 — 既有頁面拆分 / 套元件

> ⚠️ `GameCreatePage` 目前 export `STATUS_LABEL`，被 `TeamPage`/`GamePage` import。改版後 `StatusBadge`（Task 1.4）取代它；移除對 `STATUS_LABEL` 的依賴。

### Task 3.1: LoginPage 套元件

**Files:** Modify `frontend/src/pages/LoginPage.tsx`（保留 `LoginPage.css` 中 auth-* 版面，但按鈕/輸入改用 `Button`/`Input`）

- [ ] **Step 1:** 將三個 `<input className="auth-input">` 換成 `<Input className="auth-input">`；兩個按鈕換成 `<Button variant="primary">登入</Button>` / `<Button variant="ghost" type="button" onClick={...}>註冊</Button>`（import from `../ui`）。`placeholder`/`aria-label`/`type`/`autoComplete` **原樣保留**（E2E 靠 placeholder 定位）。錯誤訊息 `auth-error` 保留。
- [ ] **Step 2: typecheck 在 Phase 3 全部完成後統一跑。**

### Task 3.2: TeamsPage（落地頁，去掉自帶頁首）

**Files:** Modify `frontend/src/pages/TeamsPage.tsx`

說明：不再接收 `me`/`onLogout`（移到 AppShell）。標題「我的球隊」改成頁內 `<h1>`；建立球隊用 `Field`/`Input`/`Select`/`Button` + 成功 `useToast`；球隊卡用 `Card interactive`；空清單 `EmptyState`。

- [ ] **Step 1: 重寫 `TeamsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Card, Input, Select, EmptyState, Skeleton, useToast } from '../ui'
import './teams.css'

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[] | null>(null)
  const [name, setName] = useState(''); const [sport, setSport] = useState('baseball')
  const nav = useNavigate(); const toast = useToast()
  const load = () => api.teams.list().then(setTeams)
  useEffect(() => { load() }, [])
  async function create() {
    if (!name.trim()) return
    try { await api.teams.create({ teamName: name, sportType: sport }); setName(''); toast.show('球隊已建立'); load() }
    catch { toast.show('建立失敗', 'error') }
  }
  return (
    <section>
      <h1 className="page-title">我的球隊</h1>
      <div className="inline-form">
        <Input placeholder="球隊名稱" value={name} onChange={e => setName(e.target.value)} />
        <Select value={sport} onChange={e => setSport(e.target.value)}>
          <option value="baseball">棒球</option><option value="softball_fast">快壘</option>
          <option value="softball_slow">慢壘</option><option value="teeball">樂樂棒球</option>
        </Select>
        <Button onClick={create}>建立球隊</Button>
      </div>
      {teams === null && <Skeleton rows={3} />}
      {teams && teams.length === 0 && <EmptyState>尚無球隊，先建立一支吧</EmptyState>}
      <div className="card-grid">
        {teams?.map(t => (
          <Card key={t.teamId} interactive onClick={() => nav(`/teams/${t.teamId}`)}>
            <h3>{t.teamName}</h3>
            <p className="muted">{t.sportType} · {t.myRoles.join(', ')}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2:** `teams.css` 加 `.page-title { color: var(--accent-strong); margin: 0 0 var(--space-4); font-size: 22px; }`；移除舊 `.team-card`（已被 `Card` 取代）相關可留可刪。

### Task 3.3: PlayersTab（球員分頁，prompt/confirm → Modal）

**Files:** Create `frontend/src/pages/team/PlayersTab.tsx`（內容來自舊 `TeamPage` 的球員表）

說明：用 `useOutletContext<{ team }>()` 取球隊。改背號用一個編輯 Modal（`Input`），封存用確認 Modal（`Button variant="danger"`）。背號輸入即時驗證「只允許數字」。載入 `Skeleton`，動作結果 `useToast`。

- [ ] **Step 1: `PlayersTab.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Input, Modal, Skeleton, useToast } from '../../ui'
import '../teams.css'

export default function PlayersTab() {
  const { team } = useOutletContext<{ team: any }>()
  const teamId = team?.teamId
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
```

### Task 3.4: GamesTab（球隊比賽分頁）

**Files:** Create `frontend/src/pages/team/GamesTab.tsx`（內容來自舊 `TeamPage` 的比賽 section）

- [ ] **Step 1: `GamesTab.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '../../ui'
import '../teams.css'; import '../games.css'

export default function GamesTab() {
  const { team } = useOutletContext<{ team: any }>()
  const teamId = team?.teamId
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
```

### Task 3.5: GameCreatePage 套元件 + 路由回返

**Files:** Modify `frontend/src/pages/GameCreatePage.tsx`

說明：移除自帶 `.page`/`.page-head`/返回鈕（外殼已提供麵包屑）；`teamId` 仍用 `useParams`。表單 `<select>`/`<input>` 換 `Select`/`Input`，送出按鈕換 `Button`，成功後 `nav('/games/'+id+'/lineup')`，失敗 `toast.show(...,'error')`。**移除 `export STATUS_LABEL`**（改用 `StatusBadge`）。`applyPreset`/`onOpponentInput`/`submit` 邏輯原樣保留。

- [ ] **Step 1:** 套用上述改動（保留 form-grid 結構與 autocomplete）。

### Task 3.6: Game InfoTab（比賽資訊）

**Files:** Create `frontend/src/pages/game/InfoTab.tsx`

說明：唯讀呈現 `game` 的對手/日期/主客/賽事模式/規則旗標/地點/天氣/溫度。

- [ ] **Step 1: `InfoTab.tsx`**

```tsx
import { useOutletContext } from 'react-router-dom'
import { Card } from '../../ui'
import '../games.css'

export default function InfoTab() {
  const { game } = useOutletContext<{ game: any }>()
  if (!game) return null
  const rules = [game.dhEnabled && 'DH', game.epAllowed && 'EP', game.reEntryAllowed && '再上場'].filter(Boolean).join(' / ') || '無'
  const rows: [string, any][] = [
    ['對手', game.opponentName ?? '隊內對抗'], ['日期', game.gameDate],
    ['主/客', game.homeAway === 'home' ? '主場' : '客場'], ['賽事模式', game.matchMode],
    ['規則', rules], ['人數基準', game.rosterSize],
    ['地點', game.venue ?? '—'], ['天氣', game.weather ?? '—'],
    ['溫度', game.temperatureC != null ? `${game.temperatureC}℃` : '—'],
  ]
  return (
    <Card>
      <dl className="info-grid">
        {rows.map(([k, v]) => <div key={k} className="info-row"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </Card>
  )
}
```

- [ ] **Step 2:** `games.css` 加：

```css
.info-grid { display: grid; gap: var(--space-2); margin: 0; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border); padding: 6px 0; }
.info-row dt { color: var(--muted); } .info-row dd { margin: 0; font-weight: 600; }
```

### Task 3.7: Game LineupTab（名單編輯）

**Files:** Create `frontend/src/pages/game/LineupTab.tsx`（內容來自舊 `GamePage`）

說明：用 `useOutletContext<{ game, reload }>()` 取 game（不再自己 fetch game，但仍需 fetch players + roster）。保留 slot 編輯邏輯（`addSlot`/`update`/`removeSlot`/`save`/`validate`/`confirm`/`localWarnings`）。`save/validate/confirm` 的結果訊息改用 `useToast`；違規清單沿用 inline 區塊。按鈕換 `Button`。`POSITIONS`/`Slot`/`nextKey` 原樣搬入。確認名單成功後呼叫 `reload()` 讓外殼狀態 badge 更新。

- [ ] **Step 1: 建立 `LineupTab.tsx`**：把舊 `GamePage` 函式體搬入，移除頁首/返回鈕與 game 的 fetch（改 `const { game, reload } = useOutletContext<{ game:any; reload:()=>void }>()`），其餘照搬；`setMsg` → `toast.show`；`confirm()` 成功分支末加 `reload()`。

- [ ] **Step 2: 刪除舊檔** `frontend/src/pages/TeamPage.tsx`、`frontend/src/pages/GamePage.tsx`（內容已分拆）。

- [ ] **Step 3: 全量 typecheck + 建置**

Run: `cd frontend && npm run build`
Expected: PASS（所有 import 解析、無 TS 錯）。若殘留 `node.exe` 致 EPERM → `taskkill //F //IM node.exe` + 刪 `frontend/.vite` 後重試。

- [ ] **Step 4: Commit（建議切點，Phase 2+3）**

```bash
git add frontend/src
git commit -m "feat(ui): web app shell, nested tab routing, page refactor onto component library"
```

---

## Phase 4 — E2E 對應新導覽

> 後端需在 5199 運行且 DB 就緒；Playwright 自起前端 5200。執行：`cd frontend && npx playwright test`。

### Task 4.1: 更新 `auth.spec.ts`

**Files:** Modify `frontend/e2e/auth.spec.ts`

- [ ] **Step 1:** 確認登入後仍可見「我的球隊」（落地頁 h1）。若原案例斷言登出按鈕，改為：開帳號選單 `await page.getByRole('button', { name: /👤/ }).click()` 再點 `getByRole('menuitem', { name: '登出' })`。其餘登入流程不變（placeholder 定位不變）。
- [ ] **Step 2: 跑** `npx playwright test auth` → PASS。

### Task 4.2: 更新 `team-player.spec.ts`（封存改 Modal）

**Files:** Modify `frontend/e2e/team-player.spec.ts`

- [ ] **Step 1:** 建隊後 `page.getByText('Tigers').click()` → 進球隊預設導到 `players` 分頁。新增/斷言球員不變。**封存改寫**：移除 `page.on('dialog', ...)`；改為
```ts
await page.getByRole('button', { name: '封存' }).click()           // 開 Modal
await page.getByRole('dialog').getByRole('button', { name: '封存' }).click()  // Modal 內確認
await expect(page.getByRole('cell', { name: 'Amy' })).toHaveCount(0)
```
- [ ] **Step 2: 跑** `npx playwright test team-player` → PASS。

### Task 4.3: 更新 `m2-games-lineup.spec.ts`

**Files:** Modify `frontend/e2e/m2-games-lineup.spec.ts`

- [ ] **Step 1:** 進球隊後比賽流程改走分頁：建隊→進隊→點「比賽」分頁(`getByRole('link', { name: '比賽' })`)→「建立比賽」。建賽送出後落在 `/games/:id/lineup`。名單操作斷言不變；若原本斷言 `名單已儲存（草稿）` 等訊息文字，改為斷言 toast 文字（`getByText('名單已儲存（草稿）')` 仍可，因 toast 即為該文字）。狀態 badge 文字（草稿/名單已確認）仍可用 `getByText` 斷言。
- [ ] **Step 2: 跑** `npx playwright test m2` → PASS。

### Task 4.4: 新增 `navigation.spec.ts`

**Files:** Create `frontend/e2e/navigation.spec.ts`

- [ ] **Step 1: 寫測試**（登入→建隊→驗證外殼/分頁/佔位/麵包屑）

```ts
import { test, expect } from '@playwright/test'

test('app shell: tabs, placeholders, breadcrumb (UI shell)', async ({ page }) => {
  const email = `nav_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Nav')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()

  // 頂欄品牌 + 落地頁
  await expect(page.getByRole('button', { name: '⚾ 紀錄台' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的球隊' })).toBeVisible()

  // 建隊並進入 → 預設球員分頁 + 身分 chip
  await page.getByPlaceholder('球隊名稱').fill('Dragons')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByText('Dragons').click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)
  await expect(page.getByText(/你的身分/)).toBeVisible()

  // 佔位分頁顯示「即將推出」且不可點導頁
  await expect(page.getByText('總覽')).toBeVisible()
  await expect(page.locator('.tab-soon', { hasText: '統計' })).toHaveAttribute('aria-disabled', 'true')

  // 麵包屑可返回我的球隊
  await page.getByRole('link', { name: '我的球隊' }).click()
  await expect(page.getByRole('heading', { name: '我的球隊' })).toBeVisible()
})
```

- [ ] **Step 2: 跑全部 E2E** — `cd frontend && npx playwright test`
Expected: 4 個 spec 全綠（auth / team-player / m2-games-lineup / navigation）。

- [ ] **Step 3: 收尾殭屍 node** — `taskkill //F //IM node.exe` （若有殘留）。

- [ ] **Step 4: Commit（建議切點）**

```bash
git add frontend/e2e
git commit -m "test(e2e): update specs for app shell + tab navigation, add navigation spec"
```

---

## Self-Review 對照（plan 對 spec）

- spec §3 視覺系統 → Task 0.1（tokens）+ 各元件 CSS。✅
- spec §4 IA → Task 2.5/2.6（layouts、分頁、身分 chip、麵包屑）+ 2.7（路由）。✅
- spec §5 元件庫 → Phase 1（全 11 元件）。✅
- spec §6 路由重構 → Task 2.7。✅
- spec §7 微互動 → Skeleton(各 list)/Toast(各動作)/inline 驗證(背號)/transition(各 CSS)。✅
- spec §8 既有頁面套用 → Phase 3（登入/球隊/球員 Modal/建賽/名單）。✅
- spec §9 測試 → Phase 4（更新 3 spec + 新增 navigation，M1/M2 維持綠）。✅
- spec §10 AC → 由 Phase 4 E2E 覆蓋（AC1 落地/頂欄、AC2 分頁+chip+麵包屑、AC3 比賽分頁、AC4 Modal、AC5 skeleton/toast/即時驗證、AC6 視覺/RWD、AC7 既有綠）。

> RWD（AC6）無自動測試；由使用者在實機/縮放確認（設計定方向、細節看 UI 後微調）。
