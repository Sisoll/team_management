# 設計：Web 外殼 + 視覺 reskin + 共用元件 + 微互動

> **里程碑外的橫向工作**：來自 `docs/superpowers/backlog.md` §C（UI 視覺 polish pass），於 brainstorming 中擴大為「搭建 web app 外殼 + 資訊架構 + 元件庫 + 微互動」。
> **日期**：2026-06-10　**狀態**：設計定案、待寫 plan
> **產品事實來源**：`specs/001-baseball-record-platform/spec.md`；MVP 切片總綱 `docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md`。

## 1. 背景與問題

現有前端只實作了一條薄切片（登入 → 我的球隊 → 球員名冊 → 比賽 → 出賽名單），**沒有 web app 外殼與導覽**：每頁各自一個「← 返回」按鈕、無頂欄、無分頁、無一致的空/載入狀態，視覺上「不像 web 系統」。

根因：產品規格（spec.md，17 實體 / ~80 FR）與 MVP design 都以**功能/規則/權限**為主，**沒有資訊架構（IA）章節**。但 `legacy/prototype` 內其實藏了一套完整 web IA（扁平導覽：首頁/行事曆/統計/管理/球員/比賽/名單/回顧/報表/分享 + 右上帳號·球隊·身分切換），CLAUDE.md 也標它是「資訊架構參考」。本設計把那套扁平導覽重整為**三層階層式 IA**，並全面 reskin。

## 2. 目標與範圍

**深度**：視覺 reskin **＋** 結構（外殼/導覽/元件） **＋** 互動細節（modal / skeleton / toast / 即時驗證）。

**做**：
- 建立 web app 外殼（深綠頂欄 + 麵包屑 + 分頁列）。
- 三層 IA（全域 → 球隊內 → 比賽內），路由巢狀化。
- 共用元件庫 `src/ui/`，含以 Modal 取代瀏覽器原生 `prompt()/confirm()`。
- 微互動：skeleton 載入、toast 通知、表單即時驗證、一致 hover/transition。
- 既有 5 頁套用新外殼與元件。

**不做（非目標）**：
- 不動 backend / API / 資料 schema（純前端）。
- 不實作 M3 功能；未完成分頁一律「即將推出」佔位。
- 不改 M1/M2 已驗收的**行為契約**（CRUD、驗證邏輯、權限）。
- 不加新資料欄位（暱稱/聯絡資訊等 backlog B 不在此範圍）。
- 介面語言維持繁體中文（zh-Hant）。

## 3. 視覺系統

採 brainstorming「方向 C（計分板/儀表板）」的**結構**，但**內容區保留暖米色票**，不走全深色冷調。

- **色票**：沿用 `frontend/src/tokens.css`（暖米 `--bg #f4f1e7` / 面 `--surface #fffdf7` / 球場綠 `--accent #0e6b50` / 深綠 `--accent-strong #084a37` …）。
- **頂欄**：深綠 `--accent-strong`，白字品牌，右側帳號選單。
- **內容區**：暖米底 + 乳白卡片 + 柔和圓角（`--radius-md/lg`）+ 既有 `--shadow`。
- **新增 tokens**（加進 `tokens.css`）：
  - 間距尺度 `--space-1..6`（4/8/12/16/24/32px），統一頁面節奏。
  - 數字等寬字 `--font-mono`（統計/比分用），`"JetBrains Mono", ui-monospace, monospace`。
  - 焦點環 `--focus-ring: 0 0 0 3px var(--accent-soft)`（沿用登入頁既有手法、抽成 token）。
  - 互動過場 `--transition: 0.15s ease`。
- **密度**：資訊密度提高（卡片內含 metadata 列、狀態 chip、數字欄），但維持暖調與圓角。

## 4. 資訊架構（v2 — 全域分頁 + 我的球隊側邊欄）

> **v2 取代 v1**（v1＝「我的球隊」為獨立落地頁、逐層鑽入）。改為**全域分頁殼**，其中「我的球隊」走**側邊欄切球隊**。使用者 2026-06-10 決定。已實作的 v1 結構（TeamLayout 麵包屑落地）依此調整。

### 4.1 第 1 層 · 全域分頁殼（常駐）
- 頂欄：`⚾ 紀錄台`（品牌）＋ **右上角 `＋ 建立球隊`**（開 Modal，不放在側邊欄）＋ `👤 <顯示名稱> ▾`（帳號選單：登出）。
- 頂欄下方一排**全域分頁（GlobalTabBar，常駐）**：

| 全域分頁 | 狀態 |
| --- | --- |
| 總覽（Dashboard） | 佔位「尚未實作」 |
| 我的球隊（＝我所屬／我是成員的球隊） | ✅ |
| 行事曆（個人跨隊） | 佔位「即將推出」 |
| 統計（個人） | 佔位「即將推出」 |

- **登入 → 預設開「我的球隊」分頁**（總覽未實作；待總覽完成可改預設落總覽）。
- 「我的球隊」active 條件：路徑在 `/teams*` 或 `/games*`。

### 4.2 「我的球隊」分頁 · 側邊欄工作區（`WorkspaceLayout`）
- 版面＝**左側欄 + 右主區**。
- **左側欄**：列出「我是成員的球隊」（`teams.list`，回的就是我所屬球隊）；點擊**切換球隊**（導到該隊預設分頁）；highlight 當前球隊。**側邊欄在比賽詳情頁也常駐**。手機收合為抽屜／下拉。
- **右主區**：選中球隊的工作區＝球隊名 + 「你的身分：<角色>」chip + 球隊分頁列。
- `/teams`（未選球隊）：有球隊→自動進第一支的預設分頁；無球隊→空狀態「用右上角『建立球隊』」。

### 4.3 球隊分頁（右主區內，第 2 層）

| 分頁 | 狀態 |
| --- | --- |
| 總覽 | 佔位（未來） |
| 球員（名冊 CRUD） | ✅ |
| 比賽（賽程 / 建賽） | ✅ |
| 行事曆（該隊賽程） | 佔位（未來） |
| 統計（球隊 / 球員） | 佔位（M3） |
| 設定（資訊 / 成員 RBAC / 規則） | 佔位（未來） |

### 4.4 比賽分頁（右主區內，第 3 層）
進一場比賽 → 右主區換成比賽分頁（**側邊欄與全域分頁仍常駐**）；麵包屑 `<球隊> › <比賽>`。

| 分頁 | 狀態 |
| --- | --- |
| 資訊（對手 / 規則 / 天氣） | ✅ |
| 出賽名單（打序 / 守位 / 驗證） | ✅ |
| 記錄 / 計分板 / 數據 / 時間線 | 佔位（M3） |

> **佔位行為**：disabled 分頁不可點（顯示「即將推出 / 尚未實作」），僅渲染佔位畫面。

## 5. 共用元件庫（新增 `frontend/src/ui/`）

每個元件小而專一、吃 tokens、含 zh-Hant 與鍵盤/無障礙基本支援。

| 元件 | 用途 / 重點 |
| --- | --- |
| `AppShell` | 頂欄（品牌＋帳號選單）＋ 麵包屑 ＋ `<Outlet/>` 內容容器 |
| `TabBar` | 分頁列；item 支援 `disabled`（「即將推出」）與 active 狀態 |
| `Breadcrumb` | 可點返回的路徑列 |
| `Button` | 取代散落的 `.btn`（primary / ghost / danger），統一 focus/hover/disabled |
| `Card` | 球隊卡 / 比賽卡 / 區塊容器 |
| `Table` | 名冊 / 名單表格，含表頭樣式與 RWD（窄螢幕轉卡片或可橫捲） |
| `Field` / `Input` / `Select` | 表單欄位 + label + 錯誤訊息槽（inline 驗證） |
| `Modal` | **取代 `prompt()` / `confirm()`**；焦點鎖定、Esc 關閉、遮罩 |
| `Chip` / `StatusBadge` | 身分 chip、比賽狀態（草稿/已排定/名單已確認） |
| `EmptyState` | 「尚無球員 / 尚無比賽」一致空狀態 |
| `Skeleton` | 載入骨架（表格列 / 卡片） |
| `Toast` + `ToastProvider` | 操作成功 / 失敗通知；context + `useToast()` |

> CSS 策略：每個 ui 元件一個 co-located CSS（如 `Button.css`），全部走 tokens；把現有散在 `LoginPage.css` 的 `.btn` 等抽進 `Button`。`teams.css` / `games.css` 對應頁面樣式逐步遷移到元件或頁面區塊樣式。

## 6. 路由重構（react-router 巢狀 layout route）

```
AppShell（頂欄：品牌 + 右上「＋建立球隊」Modal + 帳號選單；其下 GlobalTabBar 常駐）
  /                        → 轉址 /teams（預設＝我的球隊；總覽未實作）
  /overview                → 佔位「總覽 尚未實作」（全域分頁）
  /calendar | /stats       → 佔位「即將推出」（全域分頁）
  WorkspaceLayout（左側欄切球隊 + 右主區 <Outlet/>；側邊欄在 /teams* 與 /games* 都常駐）
    /teams                 → 有球隊→轉址第一支 /teams/:id/players；無→空狀態
    /teams/:teamId  (TeamLayout：主區頂部 球隊名＋身分chip＋球隊分頁列)
        players ✅ / games ✅ / games/new ✅
        overview | calendar | stats | settings → 佔位
    /games/:gameId  (GameLayout：主區 比賽分頁列＋麵包屑)
        info ✅ / lineup ✅
        record | scoreboard | box | timeline → 佔位
```

- **新增**：`GlobalTabBar`（全域分頁，active 由路徑判定）、`WorkspaceLayout`（側邊欄＋Outlet）、`TeamsProvider`（context：我所屬球隊 list + `reload()`，供右上「建立球隊」Modal 與側邊欄共用，建立後刷新側邊欄）、`CreateTeamModal`（右上角觸發）。
- `AppShell` 改為：頂欄（品牌＋建立球隊＋帳號）＋ `GlobalTabBar` ＋ children。
- `TeamLayout` / `GameLayout` 保留（載入資料、分頁列、`<Outlet/>`），但渲染在 `WorkspaceLayout` 右主區內；`TeamLayout` 的「我的球隊 ›」麵包屑可簡化（側邊欄已表達球隊脈絡）。
- 未認證一律導回登入（沿用現行 `App` 守門）。
- `/teams`（我的球隊）不再是卡片清單頁——清單移到側邊欄；舊 `TeamsPage` 的建立表單移到右上 Modal。

## 7. 微互動

- **Skeleton**：球員表、比賽列表、名單載入時顯示骨架列（取代目前「…」/空白）。
- **Toast**：建立球隊/球員、改背號、封存、建賽、儲存/驗證/確認名單 → 成功與失敗皆 toast。
- **表單即時驗證**：背號只允許數字（`inputmode="numeric"`、前端即時提示；對應 backlog A，但僅前端提示，**不改後端字串型別**）；必填欄位 inline 錯誤。
- **一致 hover/transition**：所有可點元素套 `--transition`，卡片 hover 抬升。

## 8. 既有頁面套用

- **登入頁**：精修間距/層級，套 `Button`/`Field`；維持註冊/登入雙鈕。
- **我的球隊**：套 `AppShell`（此頁頂欄無分頁列）、`Card`、`EmptyState`、建立球隊改用 `Field`＋`Toast`。
- **球隊（TeamLayout）**：分頁列；**球員頁**改背號/封存改用 `Modal`（收掉 backlog D 的 `prompt/confirm` tech-debt）、表格套 `Table`、`Skeleton`、`Toast`；**比賽頁**套 `Card`/`EmptyState`。
- **建立比賽**：表單套 `Field`/`Select`/`Button`，錯誤用 inline＋`Toast`。
- **出賽名單**：表格套 `Table`、操作鈕套 `Button`、驗證結果用 `Toast`＋inline 區塊（沿用現有 localWarnings 即時提醒）。

## 9. 測試策略

- **Playwright E2E**（前端既有 E2E 基礎）：
  - 調整既有案例 selector 以對應新外殼/路由。
  - 新增：登入後落地我的球隊；進球隊看到分頁列且未做分頁為 disabled；進比賽看到分頁列；改背號走 Modal（非原生對話框）；佔位分頁顯示「即將推出」。
  - **M1/M2 既有 E2E（AC-1~7）調整後須維持綠**。
- 元件層：對純邏輯元件（如 `TabBar` disabled、`Modal` 開關、`Toast` 佇列）視需要加輕量測試；視覺回歸不在範圍。
- 依專案慣例 fast-mode：subagent 寫檔，build/test 由 controller 集中跑（JDK 與 mvn 對後端無關，此為前端 `npm`/Playwright）。

## 10. 驗收標準（AC，使用者層級確認）

1. 登入後落地「我的球隊」；頂欄＝品牌＋帳號選單，**無球隊切換器**。
2. 進球隊顯示分頁列（球員/比賽可用、其餘 disabled「即將推出」）＋「你的身分」chip ＋ 可點麵包屑返回。
3. 進比賽顯示分頁列（資訊/名單可用、記錄/計分板/數據/時間線 disabled）。
4. 球員改背號/封存走 **Modal**，不再使用瀏覽器原生 `prompt/confirm`。
5. 列表載入有 **skeleton**；操作成功/失敗有 **toast**；表單錯誤即時提示。
6. 全頁套「C 結構＋暖色」視覺、RWD 手機可用。
7. M1/M2 既有 E2E 調整後維持綠。

## 11. 風險與取捨

- **路由重構動到既有頁面結構** → 以巢狀 layout route 包裝、頁面內容元件盡量原樣搬移，降低 regression；E2E 守門。
- **佔位分頁** 可能讓使用者誤點 → disabled 樣式 + 「即將推出」提示，明確不可用。
- **元件抽取範圍**過大 → 以「現有 5 頁實際用到的」為界，不預先造未用元件（YAGNI）。
- 視覺細節（頂欄確切色、密度）使用者要看實際 UI 後再微調——本設計定方向，細節於實作後依回饋調整。
