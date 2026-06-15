# 設計文件：M3b — SSE 即時計分板 ＋ 單場統計（box score）

**日期**：2026-06-15
**狀態**：草稿（待使用者審閱）
**里程碑**：MVP M3 之 **M3b**（讀端）；接續 M3a（賽中記錄寫端，已完成並 merge `main`）
**對應 AC**：**AC-10（即時計分板）**、**AC-12（單場統計）**
**上游事實來源**：
- 產品規格 [`specs/001-baseball-record-platform/spec.md`](../../../specs/001-baseball-record-platform/spec.md)
- MVP 總綱 [`2026-06-03-baseball-record-mvp-design.md`](2026-06-03-baseball-record-mvp-design.md)（§6.3 SSE／§6.4 統計推導）
- M3a 設計 [`2026-06-11-m3a-in-game-recording-design.md`](2026-06-11-m3a-in-game-recording-design.md)

---

## 1. 目標與範圍

M3a 已打通「把一場球記下來」（事件溯源寫端＋換人/再上場驗證＋修正重算）。M3b 是**讀端**：讓記錄變成

1. **即時計分板（AC-10）**：另一裝置訂閱該場 SSE，記錄員寫事件後即時看到比分/壘包/局數更新。
2. **單場統計（AC-12）**：由同一事件流推導 box score（我隊每位打者/投手完整數據＋對手隊伍總計＋雙方 line score），數值與事件流一致；改/刪事件後重新推導仍一致。

做完 M3b＝**M3 收尾＝MVP「記一場球」12 條 AC 全數打通**。

### 1.1 地基現況（M3a 已就位，可重用）

- `GameState` snapshot 已含：`inning · half · battingSide · outs · scoreUs · scoreOpp · bases · currentBatterOrder · currentPitcherId · lineup · pitcherPitches · lineScore`。
- 每筆 `GameEvent` 已存 `snapshotAfter`（JSONB GameState）。
- 事件詞彙齊全：`SINGLE/DOUBLE/TRIPLE/HOME_RUN`、`WALK/HIT_BY_PITCH`、`STRIKEOUT`、`GROUND_OUT/FLY_OUT/SAC_FLY`、`FIELDERS_CHOICE`、`REACH_ON_ERROR`，換人 `PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY`。
- `EventApplier.apply(state, event)` 純函式可直接重放，stats 引擎重用之。
- 前端 `GameLayout` 已有「計分板 / 數據」兩個 `soon: true` 佔位分頁；`RecordTab` 已有鑽石壘包元件。

### 1.2 範圍決策（本次 brainstorming 定案）

| 項目 | 決定 | 理由 / 連帶影響 |
|---|---|---|
| 對手數據 | 我隊完整 per-player；對手只到 line score＋全隊 R/H 總計 | 對手 L2 匿名記錄（guestName/OPP），不需「對稱具名」延後項，scope 乾淨 |
| 打擊欄位 | AB/R/H/RBI/BB/K/2B/3B/HR ＋ AVG **＋ 盜壘 SB** | SB 需**新增事件型別**（盜壘），回頭碰 M3a 寫端（見 §4） |
| 投球欄位 | IP/H/R/**ER**/BB/K ＋ 用球數 | **ER 預設＝R，可手動覆寫**；box score 非純推導，需小寫入路徑（見 §3.4） |
| 統計推導架構 | 獨立 `stats` 純函式模組，on-demand 重放推導 | 單一事實來源、改/刪事件零失效、業餘量級重算成本可忽略（方案 A，見 §6） |
| 即時推播 | SSE（in-memory `SseEmitter` registry）＋ 前端 fetch streaming | 設計已定 SSE；fetch 能帶 JWT header，免動 Security filter |

---

## 2. 架構總覽

```
        Browser（記錄員寫端 / 觀看者讀端）
  ┌──────────────────────┬───────────────────────────┐
  │ RecordTab（寫事件）   │ ScoreboardTab（fetch-SSE 訂閱）│
  │  ＋盜壘按鈕（新）      │ BoxTab（GET /box-score）       │
  └──────────┬───────────┴───────────────┬───────────┘
   POST/PATCH/DELETE events        GET /stream（SSE）· GET /box-score · PUT er
             │                             │
  ┌──────────▼─────────────────────────────▼──────────┐
  │ Backend                                            │
  │  scoring（M3a）＋ GameStreamRegistry（新，in-mem）  │
  │     └ record/update/delete → AFTER_COMMIT 推 snapshot│
  │  stats（新）：StatsEngine（純函式）→ BoxScore        │
  │     └ er_override 覆寫                              │
  │  shared/eventfold：EventApplier（重放，stats 重用）  │
  └──────────────────────────┬─────────────────────────┘
                             │ JPA / SQL
  ┌──────────────────────────▼─────────────────────────┐
  │ PostgreSQL：game_event（M3a）＋ er_override（V5 新）  │
  └────────────────────────────────────────────────────┘
```

---

## 3. 後端 — `stats` 模組（AC-12）

### 3.1 StatsEngine（純函式，置於 `com.baseball.record.stats`）

`BoxScore fold(InitialLineup lineup, String sportType, List<EventView> events)`：

逐事件重放（用 `EventApplier` 取得 before/after state），依 **before-state 的 `battingSide`** 歸因：

- **進攻半局事件**（我隊打擊）→ 累進該打席球員（actor／當前打序對應 `LineupEntry`）的**打擊**統計。
- **守備半局事件**（我隊守備、對手打擊）→ 累進 `currentPitcherId` 的**投球**統計，並累進**對手隊伍總計**（R/H）。
- **換人事件**：不產生打擊/投球累計，只影響後續歸因（投手更換→之後守備事件歸新投手）。
- **盜壘事件**：`STOLEN_BASE` 給該跑者記 1 SB；`CAUGHT_STEALING` 記出局（不單列 CS 欄）。

### 3.2 推導規則（MVP，明列簡化）

**打擊（我隊每位上過場的球員一列）**：

| 欄位 | 定義 |
|---|---|
| PA | 打席數＝該球員作為打者的 PA 事件數 |
| AB | PA − BB − HBP − SAC_FLY |
| H | 1B＋2B＋3B＋HR |
| 2B/3B/HR | 各長打數 |
| R | 該球員以跑者身分跑回本壘（runnerMove `→H`）次數 |
| RBI | 該打席因其打擊跑回本壘數；`REACH_ON_ERROR` 不計（標準 RBI 細則簡化，文件註明） |
| BB / K | WALK 數 / STRIKEOUT 數 |
| SB | 成功盜壘次數（`STOLEN_BASE` 事件） |
| AVG | H / AB（AB=0 顯示 `.000` 或 `—`） |

**投球（我隊每位登板投手一列）**：

| 欄位 | 定義 |
|---|---|
| IP | 該投手在場期間我方守備記錄的出局數 / 3（顯示為 `x.0/.1/.2`） |
| H | 對手對其擊出安打數 |
| R | 對手對其得分數 |
| ER | **預設＝R**；若該 (game, pitcher) 有 `er_override` 則用覆寫值（見 §3.4） |
| BB / K | 四壞 / 三振數 |
| 用球數 | 來自既有 `pitcherPitches`（PitchTally.pitches） |

**對手 / line score**：對手只輸出隊伍總計 `R`（=scoreOpp）、`H`（守備半局對手安打累計）；line score 取 `GameState.lineScore`（逐局 top/bottom 得分）。

> **簡化清單（寫入設計文件、不視為 bug）**：RBI 用簡化規則；ER 預設等於失分（精確自責分屬延後項）；對手不做 per-player；softball 盜壘規則不特別處理。

### 3.3 API

```
GET  /api/games/{id}/box-score        （member 可讀）→ BoxScoreResponse
PUT  /api/games/{id}/pitchers/{playerId}/er   （owner）→ 設定/更新 ER 覆寫，回更新後 box
```

`BoxScoreResponse` 形狀（草案）：
```jsonc
{
  "lineScore": [ {"inning":1,"top":0,"bottom":2}, ... ],
  "team":     { "runs": 5, "hits": 8 },
  "opponent": { "runs": 3, "hits": 6 },
  "batting":  [ {"playerId","name","order","position","pa","ab","r","h","double","triple","hr","rbi","bb","k","sb","avg"} ],
  "pitching": [ {"playerId","name","ip","h","r","er","erOverridden":bool,"bb","k","pitches"} ]
}
```

### 3.4 ER 手動覆寫

- 新表 `er_override(game_id, pitcher_id, er, PRIMARY KEY(game_id, pitcher_id))`（Flyway **V5**）。
- `PUT …/pitchers/{playerId}/er`（owner）：upsert 一列；body `{ "er": <int> }`。
- box score 出表時：`pitching[].er` = 覆寫值（若有）否則 `r`；`erOverridden` 標記前端是否顯示「已手改」。
- 改/刪事件導致 R 變動時，覆寫值**保留**（手動值優先）；前端可重設（傳 `er=null` 或刪除端點，MVP 先支援設值）。

### 3.5 授權

- box score／stream＝`requireMember`（任何該隊成員可看，呼應 AC-10「另一裝置訂閱」）。
- ER 覆寫＝`requireRole(OWNER)`（與記錄寫端一致）。

---

## 4. 後端 — 盜壘事件（碰 M3a 寫端）

- **新事件型別** `STOLEN_BASE`、`CAUGHT_STEALING`。
- `EventApplier` 新增「純跑壘事件」分支：套用 `runnerMoves`（CS 含 `→OUT`，計出局、可能翻半局），但**不推進打序游標、不計 PA/AB**。
- `EventApplier.isSubstitution` 不含此二者；新增判定 `isBaserunningOnly(type)` 以走新分支。
- `ScoringService` 記錄路徑沿用（非換人、非一般 PA），不需新驗證。
- 前端 `RecordTab`：壘上有跑者時顯示「盜壘 / 盜壘失敗」按鈕，送對應 `runnerMoves`。

---

## 5. 後端 — SSE 即時計分板（AC-10）

- **`GameStreamRegistry`**（in-memory，`Map<UUID, List<SseEmitter>>`）：`subscribe(gameId)` 建 `SseEmitter`（長 timeout）並註冊；`publish(gameId, payload)` 推給該場所有訂閱者；`onCompletion/onTimeout/onError` 清理。
- **`GET /api/games/{id}/stream`**（member）：驗權後 `subscribe`，連上**立即推一次當前 state**（避免空白），之後等事件。
- **推播觸發**：`ScoringService.record/update/delete` 成功後發 Spring `ApplicationEvent`（如 `ScoreboardChanged(gameId)`）；`@TransactionalEventListener(phase = AFTER_COMMIT)` 監聽 → 重算當前 `GameState` → `registry.publish(gameId, state)`。AFTER_COMMIT 確保訂閱者只看到已落地的狀態。
- **payload**＝計分板 DTO（沿用 `GameStateResponse` 內容：比分/局/出局/壘包/當前打者投手/line score）。
- 前端用 **fetch + `ReadableStream`** 讀 `text/event-stream`（可帶 `Authorization: Bearer`），解析 `data:` 行 → 更新畫面。EventSource 無法帶 header 故不採。

> 量級假設：業餘單機 / 少量訂閱者；in-memory registry 足夠。多實例部署（未來）再換 Redis pub/sub 或訊息匯流排。

---

## 6. 統計推導架構抉擇

| 方案 | 做法 | 取捨 | 採用 |
|---|---|---|---|
| **A** | 獨立 `stats` 純函式引擎，`GET /box-score` 時重放事件流推導；除 `er_override` 外不固化統計 | 單一事實來源、改/刪事件零失效、業餘量級重算可忽略、符合設計 §6.4 | ✅ |
| B | 把統計累進塞進 `GameState` snapshot | snapshot JSONB 膨脹、scoring 與 stats 耦合、改統計定義仍須重 fold | ✗ |
| C | 固化 `GameStatLine` 表、每筆事件更新 | 最複雜、改/刪事件要處理失效、MVP 過早最佳化 | ✗（量大時再升級） |

---

## 7. 前端（移除兩個 `soon`）

- **計分板 `/games/:id/scoreboard`**（`ScoreboardTab`）：fetch-SSE 訂閱即時渲染——大比分（我 vs 對手）、逐局 line score 格、當前局/半/出局、**壘包鑽石（從 `RecordTab` 抽共用元件 `BasesDiamond`）**、當前打者/投手、用球數。非 live 時 fallback `GET /state`；斷線自動重連。
- **數據 `/games/:id/box`**（`BoxTab`）：`GET /box-score` 渲染我隊打擊表＋投球表＋line score＋對手總計；**ER 欄 owner 可點擊就地編輯**→`PUT` 覆寫後刷新。
- **`api/client`** 擴充：`events.stream(gameId, onSnapshot, onError)`（fetch streaming）、`games.boxScore(gameId)`、`games.setEr(gameId, playerId, er)`。
- **`App.tsx`** 接 `scoreboard`、`box` 兩條 route。
- 視覺一律走 design tokens；表格／鑽石沿用既有色票與圓角。

---

## 8. 資料模型異動

- **新表 `er_override`**（Flyway **V5**）：`game_id UUID · pitcher_id UUID · er INT · PK(game_id, pitcher_id)`。
- 無其他 schema 異動；box score 全部即時推導（`GameStatLine` 暫不固化）。
- 新事件型別 `STOLEN_BASE/CAUGHT_STEALING` 僅是 `game_event.event_type` 既有欄位的新值，**不需 migration**。

---

## 9. 測試策略（TDD，逐條對應 AC）

- **`StatsEngine` unit test**（純函式，大量）：手構事件流 → 逐欄位斷言（PA/AB/H/RBI/BB/K/SB/2B/3B/HR/AVG、IP/H/R/BB/K/用球數）；**含改/刪事件後重放一致**（呼應 AC-11×AC-12）。
- **`BoxScoreControllerIT`**（Testcontainers 真 PG）：記一段事件 → `GET /box-score` 數值正確；ER 覆寫 PUT 後反映、改事件後覆寫保留 → **AC-12**。
- **`GameStreamIT`**：訂閱 `/stream` → 寫事件 → 斷言訂閱端收到含新比分的 snapshot → **AC-10**。
- **盜壘**：`EventApplier` unit test（盜壘進壘/失敗出局、不推打序）；`StatsEngine` SB 計數。
- **前端 Playwright**：開賽→記錄→計分板分頁即時看到比分更新；數據分頁顯示 box score；owner 編輯 ER 生效。
- ⚠️ 後端 IT 沿用 M3a 環境坑：`export TESTCONTAINERS_RYUK_DISABLED=true`、JDK 21 就地 export、Podman machine 需 running。

**使用者確認層級**：上述 AC-10／AC-12 測試綠燈 ＋ Web 上開兩裝置（或兩分頁）實際走一遍。

---

## 10. 明確不做（延續 handoff / 設計延後項）

對稱具名對手 per-player box · 完整 ER 自責分精算（失誤歸因）· 進階打擊率 OBP/SLG/OPS · 累積 / 跨場 / 區間統計 · 公開分享（未登入觀看）· `GameStatLine` 固化 / materialized view · 多實例 SSE（Redis pub/sub）· softball 專屬盜壘規則。

---

## 11. 里程碑出口（M3b 完成定義）

- AC-10 即時計分板、AC-12 單場統計的後端 IT ＋ 前端 E2E 綠燈。
- 計分板 / 數據兩分頁可實際操作；ER 可手改。
- ⇒ M3 收尾，MVP 12 條 AC 全通；後續可進 §G 成員·RBAC 或 MVP 後階段。
