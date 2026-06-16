# 設計文件：M4 — 出賽名單管理（報名清單 ＋ 拖拉打序/守備）

**日期**：2026-06-16
**狀態**：草稿（待使用者審閱）
**里程碑**：MVP 之後第一個擴充 **M4**；接續 M3（記一場球，已完成並 merge `main`）
**定位**：把「賽前準備名單」從現有的單表手填，升級成符合實際隊務節奏的「報名清單 → 拖拉排出賽名單」。為延後的 **§G 成員·RBAC**（隊員自助報名）預留資料結構，但本里程碑不碰帳號/權限。
**上游事實來源**：
- 產品規格 [`specs/001-baseball-record-platform/spec.md`](../../../specs/001-baseball-record-platform/spec.md)
- MVP 總綱 [`2026-06-03-baseball-record-mvp-design.md`](2026-06-03-baseball-record-mvp-design.md)
- M2 名單設計 [`2026-06-08-m2-games-lineup-design.md`](2026-06-08-m2-games-lineup-design.md)（本里程碑改寫其 `LineupTab` 與名單流程）

---

## 1. 目標與範圍

現況（M2）：`LineupTab` 是一張平表，每列手填打序數字、選球員/路人、守位、先發/替補；存草稿 → 驗證 → 確認（`lineup_confirmed`）。痛點：

1. 打序用手打數字，調動麻煩；先發/替補只是一個下拉，沒有「兩區」的空間感。
2. **「出賽名單」≠「當天會來的人」**：賽前不知道誰到、有人遲到，硬要先排好不符實際。

本里程碑把名單拆成**兩個概念**：

- **報名清單（`game_signup`）**：寬鬆候補池。隊長把可能來的人（球員/路人）丟進去，標記報名/到場/遲到/請假/放鴿子。**永不驗證、允許不完整**。
- **出賽名單（沿用 `lineup_slot`）**：隊長從報名池**拖**出來排打序/守位（也能直接補非報名者），分先發/替補。**只有它驗證**，且人數不足可繼續。

做完 M4＝賽前名單體驗貼合真實隊務，且累積出每人每場的出賽狀態資料（為下一個「跨場出席率」報表里程碑鋪路）。

### 1.1 地基現況（可重用，零或極小改動）

- `lineup_slot` 既有欄位（`batting_order` / `field_position` / `lineup_status` starter|bench / `player_id` XOR `guest_name`）**完全夠用**，schema 不動。
- `LineupValidator`（純函式）**本來就只驗先發**（投手、打序連續 1..N、守位齊全、DH/EP 推導、可出賽 7 條）→ 報名清單天然不參與，**驗證邏輯一行不改**。
- `Player` 已有 `availability`（available/unavailable）與 `roster_status`（active/archived）＝**長期**狀態；本里程碑的 `game_signup.status` 是**單場**狀態，兩者正交、各司其職。
- 既有 roster API（`GET/PUT /roster`、`POST /roster:validate`、confirm 走 `PUT /games/{id}`）**全部沿用、不動**。

### 1.2 範圍決策（本次 brainstorming 定案）

| 項目 | 決定 | 理由 / 連帶影響 |
|---|---|---|
| 報名 vs 出賽 | **拆兩張表**（`game_signup` ＋ 沿用 `lineup_slot`） | 兩者規則不同（一不驗一驗）、語意乾淨；自助報名未來只 insert 報名表、碰不到出賽名單，權限天然分離 |
| 報名由誰建 | **隊長/管理員手動**（`requireRole OWNER`） | 本里程碑自包含，不碰帳號/權限；`created_by` 欄預留未來自助報名 |
| 報名狀態 | 五值：報名/到場/遲到/請假/**放鴿子** | `no_show`（報名了沒來）供日後算出席率；資料現在記全，免日後補 migration |
| 跨場出席率報表 | **延後**，獨立下一里程碑（歸 stats 模組） | 本里程碑只存資料、聚焦拖拉名單體驗；報表＝新 aggregate query＋球員出席率頁 |
| 拖拉庫 | **`@dnd-kit`**（core + sortable，新依賴） | 原生 HTML5 DnD 在 touch 幾乎不可用；frontend 要 RWD＋鍵盤/無障礙，@dnd-kit 同時支援 pointer/touch/keyboard sensors |
| 報名 API 形狀 | **整批 PUT**（deleteAll+insert） | 對稱現有 roster PUT；前端送全量、後端簡單，免逐筆 diff |
| lineup↔signup 連結 | **不加跨表 FK**；前端用 `player_id` 比對標記「已排」 | 保 `lineup_slot` 零改動；路人靠 `guest_name` 比對 |

---

## 2. 架構總覽

```
                     Browser — LineupTab（看板兩欄）
  ┌─────────────────────────────┬──────────────────────────────┐
  │ 報名清單（左）                │ 出賽名單（右）                  │
  │  ＋報名／設狀態 chip          │  先發(ordered) / 替補           │
  │  @dnd-kit 拖拉來源            │  ＋直接加入 · 守位 select        │
  └──────────────┬──────────────┴───────────────┬──────────────┘
   GET/PUT /signups（新）            GET/PUT /roster · POST /roster:validate（沿用）
                 │                                │
  ┌──────────────▼────────────────────────────────▼─────────────┐
  │ Backend                                                       │
  │  signup（新模組）：SignupController/Service/Entity/Repo/DTO    │
  │  lineup（沿用）：LineupService · RosterValidationService      │
  │  shared/ruleengine LineupValidator（不改）                    │
  │  DB：V6__game_signup.sql（新表）；lineup_slot 不動            │
  └──────────────────────────────────────────────────────────────┘
```

拖拉是**純前端狀態**；放手後前端各自 `PUT /signups`（左池全量）與 `PUT /roster`（右名單全量）。後端不需要知道「拖」這個動作，只收兩份覆寫後的清單。

---

## 3. 資料模型

### 3.1 新表 `game_signup`（migration `V6__game_signup.sql`）

```sql
CREATE TABLE game_signup (
    signup_id   UUID PRIMARY KEY,
    game_id     UUID         NOT NULL REFERENCES games(game_id),
    player_id   UUID         REFERENCES players(player_id),
    guest_name  VARCHAR(120),
    status      VARCHAR(20)  NOT NULL DEFAULT 'signed_up',
    note        VARCHAR(200),
    sort_index  INT          NOT NULL DEFAULT 0,
    created_by  UUID         NOT NULL REFERENCES users(user_id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_signup_source CHECK ((player_id IS NOT NULL) <> (guest_name IS NOT NULL))
);
CREATE UNIQUE INDEX uq_signup_game_player ON game_signup (game_id, player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_signup_game ON game_signup (game_id);
```

- `status` 值域：`signed_up`(報名) · `present`(到場) · `late`(遲到) · `absent`(請假) · `no_show`(放鴿子)。
- `UNIQUE(game_id, player_id)`（partial，僅註冊球員）：同一球員一場不重複報名；路人（`guest_name`）不限。
- `created_by`：本里程碑＝操作的隊長；**預留**未來自助報名時記錄本人 user。
- `sort_index`：報名池內顯示順序（拖拉可調，純展示用，不影響任何規則）。

### 3.2 沿用 `lineup_slot`

**不動**。出賽名單仍是 `game_roster` ＋ `lineup_slot`（starter/bench + batting_order + field_position）。前端把「某報名者是否已排進出賽名單」用 `player_id`（路人用 `guest_name`）在前端比對標記，後端不需關聯。

### 3.3 出席率資料就緒（本里程碑只存、不算）

每場每球員一筆 `game_signup`，跨場 `GROUP BY player_id, status` 即可導出每人「報名 N / 到場+遲到 M / 放鴿子 K / 出席率」。報表 UI 與 aggregate query 屬**下一里程碑**（stats 模組），本里程碑不實作。

---

## 4. API

### 4.1 報名（新）`/api/games/{id}/signups`

| Method | 行為 | 權限 |
|---|---|---|
| `GET` | 回該場報名清單（含 status/note/sort） | `requireMember` |
| `PUT` | **整批覆寫**報名清單（deleteAll + insert）；body＝`{ signups: [...] }` | `requireRole OWNER` |

`SignupDto`：`playerId`(nullable) XOR `guestName`、`status`(enum，default signed_up)、`note`(≤200)、`sortIndex`。後端驗證：每筆恰一個來源（player/guest）、status 在值域內、`UNIQUE(game_id,player_id)` 由 DB 把關（重複回 400/409）。

> 與 `roster` PUT 同模式（先 `deleteByGameId` 再批次 insert），語意一致、好測。

### 4.2 出賽名單（沿用，不動）

`GET/PUT /api/games/{id}/roster`、`POST /api/games/{id}/roster:validate`、confirm 走 `PUT /api/games/{id}`（`gameStatus=lineup_confirmed`）。`LineupValidator` 不改。

### 4.3 前端 api client

`api.signups = { get, put }`（對稱既有 `api.roster`）。

---

## 5. 前端 UX（`LineupTab` 改兩欄看板）

- **版面**：左欄報名清單、右欄出賽名單（上先發 ordered／下替補）。RWD：窄螢幕上下堆疊。
- **拖拉（@dnd-kit）**：
  - 左→右：報名者拖進先發（自動指派下一個打序）或替補。
  - 右欄內上下拖：改打序，前端自動重編 `1..N`。
  - 右→左 / 移除：退回報名池。
  - **＋直接加入**（右）：補非報名者（既有 player picker / 路人輸入）——也會同步在報名池建一筆 `present` 報名（保出席率資料完整）。
  - **＋報名**（左）：加候補（player picker / 路人），預設 `signed_up`。
  - status chip：點擊循環/選單切換 報名/到場/遲到/請假/放鴿子。
- **守位**：先發每列一個守位 select（沿用現有 `POSITIONS`）。
- **底部摘要**：顯示「出賽 N 人（先發 X／替補 Y）」與人數不足提醒；保留「儲存草稿／驗證名單／確認名單」三鈕，行為不變。
- **無障礙**：@dnd-kit keyboard sensor（Tab 聚焦＋空白鍵抓放＋方向鍵移動）；拖拉項目有 `aria-label`。

---

## 6. 驗證／確認流程（不變）

- 報名清單：**永不驗證**。
- 出賽名單：按「驗證名單」或「確認名單」時跑 `LineupValidator`（只看先發）；人數不足、缺守位等 → 回 violations，前端顯示提醒，**草稿仍可存**。
- 確認＝`game_status → lineup_confirmed`；確認後改名單需先 revert（既有行為）。遲到者後到 → revert → 從報名池拖入 → 再確認。

---

## 7. 明確不做（non-goals）

- 隊員自助報名／邀請／通知（延後＝§G 成員·RBAC；`created_by` 已留）。
- 跨場出席率報表 UI（延後＝下一個 stats 里程碑；本里程碑只存資料）。
- 比賽中換人／re-entry 即時替補（屬計分流程，另案；已由 M3a 處理場中換人）。
- 報名截止時間、自動把賽末未到者標 `no_show`（本里程碑由隊長手動標）。

---

## 8. 測試（TDD，逐條對 AC）

- **後端 unit / IT**：
  - `SignupServiceIT`（Testcontainers 真 PG）：整批 PUT 覆寫、player/guest 二擇一、`UNIQUE(game_id,player_id)` 重複擋下、status 值域、OWNER 權限、GET 回正確清單。
  - `LineupValidator` 既有測試**回歸跑綠**（確認本里程碑沒污染先發驗證）。
- **前端 E2E（Playwright）**：`m4-roster-signup.spec.ts`
  - 報名（球員＋路人）→ 設狀態 → 清單不觸發驗證（AC-A）。
  - 拖報名者進先發、打序自動 1..N（AC-B）；進/出替補、退回池、直接加入（AC-C）。
  - 設守位 → 驗證跑先發規則、人數不足提醒不擋（AC-D）。
  - 確認 → `lineup_confirmed`；revert → 補遲到者 → 再確認（AC-E）。
- ⚠️ 後端 IT 前設 `TESTCONTAINERS_RYUK_DISABLED=true`（Podman/Windows）；JDK 21 就地 export。

---

## 9. 驗收標準（AC）

| AC | 描述 |
|---|---|
| **AC-A** | 隊長能在報名清單加球員/路人並設五值狀態（報名/到場/遲到/請假/放鴿子）；此清單不觸發任何驗證 |
| **AC-B** | 拖報名者進先發自動排打序；欄內上下拖改打序（自動 1..N 重編） |
| **AC-C** | 能進/出替補、退回報名池、「直接加入」非報名者 |
| **AC-D** | 先發每列可設守位；驗證對先發跑既有規則，人數不足提醒但不擋存草稿 |
| **AC-E** | 確認名單 → `lineup_confirmed`；遲到者可 revert→補入→再確認 |
| **AC-F** | 報名與出賽資料分離（`game_signup` vs `lineup_slot`）；`game_signup` 含 `no_show` 與 `created_by`（為出席率＋自助報名鋪路） |
| **AC-G** | 看板手機 touch 可拖、鍵盤可操作（RWD/a11y） |

---

## 10. 檔案影響面（預估）

- **新增**：`backend/.../signup/{SignupController,SignupService,GameSignup,GameSignupRepository,dto/*}`、`backend/src/main/resources/db/migration/V6__game_signup.sql`、`frontend/e2e/m4-roster-signup.spec.ts`。
- **改寫**：`frontend/src/pages/game/LineupTab.tsx`（表格→看板）、`frontend/src/api/client.ts`（加 `signups`）、`frontend/package.json`（加 `@dnd-kit/*`）。
- **不動**：`lineup_slot` schema、`LineupService`、`RosterValidationService`、`LineupValidator`、所有 M3a/M3b。
