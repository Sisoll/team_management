# 設計文件：棒壘球紀錄平台 — 全端重做 MVP（記一場球）

**日期**：2026-06-03
**狀態**：草稿（待使用者審閱）
**來源規格**：[`specs/001-baseball-record-platform/spec.md`](../../../specs/001-baseball-record-platform/spec.md)（既有完整規格，本文件以其為產品事實來源）
**範圍**：本次重做的**第一條垂直切片**（MVP），其餘能力列為後續階段，各自再走 spec → plan → 實作。

---

## 1. 背景與目標

既有專案是一份**極完整的規格 + 純前端靜態雛型（mock、無後端）**。本次重做的目標是把它**升級成真實可運作的全端系統**，並把內容做得更完整。

- 既有規格（17 實體、約 80 條 FR、規則模式、驗證規則、使用者故事）**保留為產品事實來源**。
- 既有 20 個 HTML 原型 + mock data **保留為 UI／資訊架構參考**。
- 本文件只設計 **MVP 切片**：一條龍打通「**記一場球**」——帳號 / 球隊 / 球員 → 建比賽 → 出賽名單 → 賽中即時記錄 → 單場統計。

### 開發方式

- 採 **SDD（規格驅動開發）+ superpowers**（brainstorming → writing-plans → TDD 實作）。
- 使用者**只需在 AC（驗收標準）層級確認結果**，不需逐行看 code（使用者熟 Java，可選擇性 review）。

---

## 2. 決策紀錄（本次 brainstorming 定案）

| 決策 | 結論 | 理由 |
|---|---|---|
| 交付目標 | **真實全端系統**（後端 + DB + 真實登入 + 持久化） | 不再是 mock，要能實際運作 |
| 平台分期 | **Phase 1：響應式 Web（RWD）**；**未來：iOS + Android 原生 app** | 原生 app 之後處理語音 / 拍照輔助記錄較佳 |
| 後端關鍵原則 | **API-first**（REST + OpenAPI） | Web 先吃這套 API，未來原生 app 重用同一套，不打掉重練 |
| 後端語言 | **Java Spring Boot** | 使用者熟、可 review；複雜規則 / 權限在強型別 + Spring 生態最穩、最好測 |
| 資料庫 | **PostgreSQL** | 高度關聯 + 複雜聚合（window function / CTE）+ JSONB 存事件快照，最契合「統計 + 事件時間線」領域 |
| Web 前端 | **React + TypeScript** | 生態最大、AI 產出可靠，且與未來 RN 共用語言 |
| 未來手機 | **React Native（Expo）** | 與 Web 同語言，可共用 API client / 型別 / 驗證；語音 / 拍照模組成熟；一套上 iOS + Android |
| 辨識 / 語音 | **未來以獨立服務或雲端 API** | 不綁死主後端語言；音檔 / 照片進物件儲存（S3 相容），DB 只存參照 |
| 即時 / 離線 | **Phase 1 需即時計分板（SSE）**；不做離線 | 紀錄員寫、其他人即時看；離線留給未來原生 app |
| 登入 | **Spring Security + JWT 自管 identity + DB 內 RBAC 授權** | 多球隊 × 多角色授權本來就得放自己 DB；託管 auth 對 MVP 是多花錢多依賴 |
| 部署 | **本機開發優先**，容器化可隨時搬 | MVP 先在本機跑通，部署有需要再決定 |
| 本機容器執行時 | **Podman（無 Docker）** | compose 用 `podman compose`；Testcontainers 走 Podman socket（見 §9） |
| MVP 角色管理 | **精簡版**：owner 全包，RBAC schema + 授權層保留；成員 / 角色管理 UI 列下一個 slice | 最快打通「記一場球」核心 |

---

## 3. 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│  Client（Phase 1: 響應式 Web；未來: iOS/Android RN-Expo）     │
│  React + TypeScript SPA                                       │
│   ├─ 記錄員操作（寫事件 → REST POST）                          │
│   └─ 計分板觀看（訂閱 SSE → 即時收比分/壘包）                  │
└───────────────┬───────────────────────────┬─────────────────┘
        REST/JSON (OpenAPI)            SSE（即時推播）
                │                           │
┌───────────────▼───────────────────────────▼─────────────────┐
│  Backend：Java Spring Boot（API-first）                       │
│   模組：auth · team · player · game · lineup · scoring · stats │
│   shared：rule-engine（規則驗證）· authorization · event-fold │
└───────────────────────────┬─────────────────────────────────┘
                            │ JPA / SQL
┌───────────────────────────▼─────────────────────────────────┐
│  PostgreSQL — 關聯核心 + JSONB（事件快照 / payload）          │
└──────────────────────────────────────────────────────────────┘
   未來：音檔/照片 → 物件儲存（S3 相容）；辨識 → 獨立服務/雲端 API
```

---

## 4. MVP 範圍

### 4.1 IN-scope 功能

| # | 功能 | MVP 做到哪 |
|---|---|---|
| 1 | 帳號 / 登入 | Email + 密碼註冊登入、JWT、取得自身資料 |
| 2 | 球隊 | 建立球隊（名稱、球種）；建立者 = owner |
| 3 | 角色 / 權限 | RBAC schema（owner / manager / coach / scorer / member）+ 授權檢查；**管理 UI 精簡（owner 全包）** |
| 4 | 球員 | 球員 CRUD（姓名 / 背號 / 主守位 / 在隊狀態）；帳號連結流程延後 |
| 5 | 比賽 | 建比賽（日期 / 地點 / 對手 / 主客 / 棒或壘 / 正式或友誼 / 選規則集）+ 狀態流轉 |
| 6 | 規則集 | 平台預設 preset（棒 / 壘 × 正式 / 友誼，9 / 10 / DH / EP、再上場旗標）；球隊可切球種 + 賽事模式 |
| 7 | 出賽名單 | 先發打序 + 守位 + 替補；依 preset 驗證名單合法性 |
| 8 | 賽中即時記錄 ⭐ | 打席結果、得分、出局、壘包、換人（代打 / 代跑 / 守位 / 投手 / 再上場）+ 規則驗證 + 事件時間線 + 補登修正重算 + **SSE 即時計分板** |
| 9 | 單場統計 | 由事件推導 box score（打擊 / 基本投球）+ 隊伍單場數據 |

### 4.2 明確延後（各自為後續 slice，再走 spec → plan）

行事曆 / 通知 / 報名回覆 · 累積統計 / 球隊戰績 / 區間報表 · 比賽分類 / 特殊裁定（延賽 / 棄賽 / 對手棄權 / 違規判勝負） · 公開分享 A/B/C · 球員歷史時間線 UI · 帳號連結流程 · 臨時紀錄權限申請與審核 · 掃描 / 語音輔助記錄 · 原生 iOS / Android app。

---

## 5. 資料模型（MVP 子集：取既有 17 實體中的 10 個）

> 欄位以既有 [`data-model.md`](../../../specs/001-baseball-record-platform/data-model.md) 為基礎，並補上事件溯源所需欄位。延後實體：TeamCalendarEntry、PersonalCalendarEntry、AttendanceResponse、NotificationTask、TemporaryScorerRequest、CumulativeStatView、SharePolicy。

1. **UserAccount** — `userId · displayName · email · passwordHash · accountStatus · createdAt`
2. **Team** — `teamId · teamName · sportType · teamStatus · createdAt`
3. **TeamMembership** — `membershipId · teamId · userId · roles[] · membershipStatus`（角色可多選；授權以角色集合判定）
4. **PlayerProfile** — `playerId · teamId · displayName · uniformNumber · primaryPositions[] · secondaryPositions[] · rosterStatus · linkedUserId?(延後啟用)`
5. **Game** — `gameId · teamId · sportType · matchMode · rulePresetId · gameDate · venue · opponentName · homeAway · gameStatus`
   - 狀態：`draft → scheduled → lineup_confirmed → live → paused → completed → reviewed`
   - （延後欄位：competitionCategory / gameResolution / standingsInclusionMode / visibility / shareTier）
6. **RulePreset** — `rulePresetId · sportType · matchMode · supportsReEntry · supportsDH · supportsEP · friendlyRosterFlexEnabled`
7. **GameRoster** — `gameRosterId · gameId · startingLineup[] · benchPlayers[] · activeParticipants[]`
8. **LineupSlot** — `slotNo · playerId · battingOrder · fieldPosition · lineupStatus`
9. **GameEvent**（append-only，事件溯源核心）—
   `eventId · gameId · inning · half · sequenceNo · eventType · actorPlayerId · relatedPlayers[] · payload(JSONB) · scoreDelta · outsAfter · basesAfter(JSONB) · snapshotAfter(JSONB) · captureSource · createdAt`
10. **GameStatLine** — `gameId · playerStats[] · teamStats · derivedAt`（MVP 即時推導，可後續固化）

**關係（MVP 子集）**：Team 1..* TeamMembership / PlayerProfile / Game；Game 1..1 RulePreset / GameRoster；GameRoster 1..* LineupSlot；Game 1..* GameEvent；Game 1..1 GameStatLine。

---

## 6. 核心技術設計

### 6.1 事件溯源（賽中記錄）

- `GameEvent` **只增不改**；場上狀態（比分 / 出局 / 壘包 / 在場球員）= 事件流「**摺疊（reduce）**」推導。
- 每筆寫入即計算 `snapshotAfter` 存 JSONB —— 加速讀取與計分板推播。
- **補登 / 修正**：對某筆事件做修正後，從該點**重算後續所有快照**（對應 VR-007）。
- 計分板、box score、事件時間線**全部源自同一事件流**（單一事實來源）。
- MVP `eventType` 涵蓋：安打（1B/2B/3B/HR）、保送 / 觸身、三振、各類出局（接殺 / 滾地 / 雙殺 / 犧牲打…）、失誤 / 野手選擇、推進與得分、換人（代打 / 代跑 / 守位調整 / 投手更換 / 再上場）、局數推進。

### 6.2 規則引擎（rule-engine，純函式）

- 輸入：`RulePreset`（棒 / 壘 · 正式 / 友誼 · 9/10/DH/EP · 再上場旗標）+ 當前名單 / 場上狀態 + 嘗試動作。
- 輸出：合法 / 不合法 + 原因。
- 套用於：名單建立驗證（VR-001 / VR-005）、賽中換人與再上場驗證（VR-002 / VR-003）、友誼賽彈性人數（VR-004）。
- 設計成 per `sportType + matchMode` 的 policy；純函式 → 大量 unit test 對應規格的 RM / VR。

### 6.3 即時計分板（SSE）

- `GET /api/games/{id}/stream`（Server-Sent Events）：訂閱者持續收 scoreboard 狀態（比分 / 局 / 出局 / 壘包 / 在場）。
- 記錄員寫事件走一般 REST `POST`；service 寫入成功後，**發佈最新 snapshot** 給該場訂閱者。
- 單向場景用 SSE 即足夠；未來原生 app 若需雙向再升級 WebSocket。

### 6.4 統計推導（stats-engine，純函式）

- 由事件流推 box score：打者 AB / H / R / RBI / BB / K…、投手基本 IP / H / R / ER / BB / K、隊伍 line score。
- MVP 即時計算；量大時再固化 `GameStatLine` 或用 materialized view。

### 6.5 授權

- JWT 解出 `userId` → 載入該 team 的 membership / roles → policy 檢查動作（誰能建賽、誰能記錄、誰能改名單）。
- MVP：owner 全包；授權層已就位，未來補成員 / 角色管理只是擴充。

---

## 7. API 介面（MVP 概覽，REST + OpenAPI）

```
# Auth
POST   /api/auth/register
POST   /api/auth/login            → JWT
GET    /api/auth/me

# Team
POST   /api/teams
GET    /api/teams                 （我所屬球隊）
GET    /api/teams/{id}

# Player
POST   /api/teams/{teamId}/players
GET    /api/teams/{teamId}/players
GET    /api/players/{id}
PUT    /api/players/{id}
DELETE /api/players/{id}

# Rule preset（seeded）
GET    /api/rule-presets

# Game
POST   /api/teams/{teamId}/games
GET    /api/teams/{teamId}/games
GET    /api/games/{id}
PATCH  /api/games/{id}            （狀態流轉）

# Roster / Lineup
PUT    /api/games/{id}/roster     （先發打序 + 守位 + 替補）
POST   /api/games/{id}/roster:validate   → 規則驗證結果

# Scoring（事件溯源）
POST   /api/games/{id}/events
GET    /api/games/{id}/events     （時間線）
PATCH  /api/games/{id}/events/{eventId}   （修正 → 重算）
DELETE /api/games/{id}/events/{eventId}   （刪除 → 重算）
GET    /api/games/{id}/state      （當前 snapshot）
GET    /api/games/{id}/stream     （SSE 即時計分板）

# Stats
GET    /api/games/{id}/box-score
```

---

## 8. 專案結構

```
baseball_record/
├── backend/                      # Spring Boot（按模組分 package）
│   └── src/main/java/.../{auth,team,player,game,lineup,scoring,stats,shared}
│       └── shared/{ruleengine, authorization, eventfold}
├── frontend/                     # React + TypeScript（Vite）
├── compose.yaml                  # Postgres + backend + frontend（本機 `podman compose`）
└── docs/superpowers/specs/       # 本設計文件與後續 spec
```

> 既有 `app/`、`pages/`、`assets/`（HTML 原型 + mock data）保留為 UI 參考，不直接進入新 codebase。

---

## 9. 測試策略與「使用者怎麼確認」

- **純函式引擎**（rule-engine / stats-engine / event-fold）→ 大量 **unit test**，逐條對應規格的 RM / VR。
- **API** → **integration test**（Spring Boot Test + Testcontainers 真 Postgres），**每條對應一條 AC 的 Given / When / Then**。
  - ⚠️ **本機只有 Podman**：Testcontainers 需透過 **Podman socket**（Windows 下啟用 podman machine 的 socket、必要時 `DOCKER_HOST` 指向 podman；ryuk 視情況設定或關閉）。compose 用 `podman compose`，compose 檔本身相容。
- **使用者確認的「結果」= 這些 AC 測試綠燈 + Web 上能實際操作走一遍**（不需看 code）。
- 採 TDD（superpowers `test-driven-development`）：先寫對應 AC 的測試，再實作。

---

## 10. MVP 驗收標準（AC，使用者確認層級）

> 對應既有規格的使用者故事 US2（球員）、US3（比賽 / 名單）、US4（賽中記錄），並補上帳號 / 統計。

- **AC-1 帳號**：使用者可註冊、登入並取得 JWT；未登入不得存取受保護 API。
- **AC-2 球隊**：登入者可建立球隊，建立者自動成為 owner 並擁有完整權限。
- **AC-3 球員**：owner 可新增 / 編輯 / 刪除球員（含背號、主守位、在隊狀態），並列出球隊球員。
- **AC-4 建比賽**：owner 可建立一場「棒球或壘球 × 正式或友誼」的比賽並選定規則集；比賽進入 `scheduled`。
- **AC-5 名單驗證（合法）**：在 9 人正式賽下設定合法先發打序與守位，系統通過驗證並可進 `lineup_confirmed`。
- **AC-6 名單驗證（不合法）**：先發配置不符規則集（如人數 / 守位缺漏）時，系統在開賽前明確指出不合法與原因（VR-005）。
- **AC-7 友誼賽彈性**：壘球友誼賽 + EP 模式下，登錄 / 出賽人數可超過正式守備人數而不被判非法（VR-004）。
- **AC-8 賽中記錄**：紀錄員逐筆輸入打席與換人事件，系統即時更新比分 / 出局 / 壘包 / 在場球員（事件溯源推導）。
- **AC-9 再上場驗證**：規則集允許再上場一次時，系統追蹤該球員是否已用過；不允許時任何再上場嘗試被標為不合法（VR-002 / VR-003）。
- **AC-10 即時計分板**：另一裝置訂閱該場 SSE，於紀錄員寫入事件後即時看到比分 / 壘包更新。
- **AC-11 補登修正重算**：對既有事件做修正後，後續快照與單場統計依修正後時間線重新推導（VR-007）。
- **AC-12 單場統計**：比賽記錄後，可取得該場 box score（打者與投手基本數據 + 隊伍 line score），數值與事件流一致。

---

## 10.5 MVP 內部里程碑（M1 → M3，依賴順序）

整份 MVP **不放進單一 plan**（會 ~40-80 task，難審難執行）。切成 3 個有依賴順序的子里程碑，**每個各自跑 writing-plans → tasks → 子代理 TDD → 確認 AC**，做完一個再進下一個，讓 plan 永遠保持可審大小。

| 里程碑 | 內容 | 產出（可 demo） | AC | 狀態 |
|---|---|---|---|---|
| **M1 身分與球隊基礎** | auth（註冊/登入/JWT）+ 建球隊（owner）+ RBAC schema/授權層 + 球員 CRUD | 可登入、建隊、管球員名單 | AC-1,2,3 | ✅ **已完成**（merge `master`） |
| **M2 比賽與出賽名單** | 建比賽（棒/壘×正式/友誼/對內+規則帶入可改）+ 規則 preset（基底模板）+ 名單（打序/守位/替補/路人）+ 名單驗證 | 建一場合法比賽與名單 | AC-4,5,6,7 | ✅ **已完成**（branch `feat/m2-games-lineup`；後端 52 tests + E2E 綠） |
| **M3 賽中記錄與單場統計** | 事件溯源 + 賽中記錄 + 換人/再上場驗證 + SSE 即時計分板 + 修正重算 + 單場 box score | 記完整一場、即時計分板、單場統計 | AC-8,9,10,11,12 | ⏳ 未開始 |

- 每個里程碑＝完整垂直切片（後端＋前端＋測試），做完即可 demo、驗 AC。
- **M3 最重**；跑 writing-plans 時若仍過大，再拆 M3a（事件/狀態/驗證）＋ M3b（SSE 計分板/統計）。
- 執行順序：**M1 → M2 → M3**（後者依賴前者）。

**里程碑文件對照**（各切片的設計/計畫事實來源，本 MVP design 為總綱）：
- M1-A：`specs/.../`（auth）；M1-B：[`2026-06-04-m1b-teams-players-rbac-design.md`](2026-06-04-m1b-teams-players-rbac-design.md) + plan。
- M2：設計 [`2026-06-08-m2-games-lineup-design.md`](2026-06-08-m2-games-lineup-design.md)、計畫 [`../plans/2026-06-08-m2-games-lineup.md`](../plans/2026-06-08-m2-games-lineup.md)。
  - ⚠️ M2 把規則模型由「固定 preset FK」改為「`RulePreset`=seeded 基底模板、`Game` 自帶可改規則欄位、DH/EP 由名單推導」——本檔 §5/§6 的 `RulePreset(supportsDH/EP…)` 與 §7 API 為 MVP 初版概念，**M2 實作以 M2 design doc 為準**。

---

## 11. 後續階段（平台其餘能力的分解）

每項各自再走 brainstorming →（或直接）spec → plan → 實作：

1. 成員 / 角色管理 UI（邀請、指派、多角色切換）
2. 行事曆 + 出賽通知 + 報名回覆 + 人數統計
3. 累積統計 + 球隊戰績 + 比賽分類 + 區間報表（3 個月 / 1 年 / 自訂）
4. 特殊結果裁定（延賽 / 棄賽 / 對手棄權 / 違規判勝負）與戰績納入
5. 公開分享 A / B / C 層級
6. 球員歷史時間線、帳號連結流程、臨時紀錄權限申請審核
7. 原生 iOS / Android app（重用 API）+ 語音 / 拍照辨識輔助記錄

---

## 12. 假設與待決

**假設**：業餘量級資料量；MVP 不做離線；統計即時計算；UI 沿用既有原型的資訊架構。

**待決（不阻塞 MVP 設計，實作前可再定）**：
- 部署目標（本機跑通後再決定雲端 / 自架）。
- 規則引擎中各類出局 / 推進的細項判定表（實作時依棒 / 壘規則展開）。
- box score 要涵蓋的統計欄位最終清單（先以標準打擊 / 基本投球為準）。
