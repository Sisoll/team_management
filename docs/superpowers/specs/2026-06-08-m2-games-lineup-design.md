# M2 設計：比賽 + 規則設定 + 出賽名單 + 名單驗證

> 里程碑 **M2**（MVP design §10.5）。對應 **AC-4（建比賽）/ AC-5（合法名單）/ AC-6（不合法名單）/ AC-7（友誼賽彈性）**。
> 前置：M1-A（登入/JWT）、M1-B（球隊/球員/域內 RBAC）已完成並 merge `master`。
> 來源：brainstorming 兩批問題與末段「✅ M2 定案彙整」（[`2026-06-05-m2-brainstorming-questions.md`](2026-06-05-m2-brainstorming-questions.md)）、MVP design §4–§7、`specs/001-baseball-record-platform/`。
> 本檔為 brainstorming 產出的設計事實來源；實作計畫見後續 `docs/superpowers/plans/`。

## 1. 範圍與目標

在已有的球隊/球員之上，讓 owner：**建立一場比賽（棒/壘 × 正式/友誼/對內，帶入規則基底後可自由調整）→ 編排出賽名單（打序/守位/先發替補/路人）→ 在開賽前驗證名單合法性並確認**。**全端**：後端 REST API + rule-engine 純函式 + React 全 UI + Playwright E2E。

gameStatus M2 只到 `lineup_confirmed`（名單已確認）；`live` 之後（賽中記錄/計分板/統計）整段是 M3。

**OUT of M2**（已記 `docs/superpowers/backlog.md`）：
- → **M3（backlog E）**：賽中換人（代打/代跑/守位/投手/再上場）、EP↔守備中途對調、中途取消/啟用 DH、中途 ±人（傷退/遲到）、棒次中途增減、傷退無補→自動出局、賽中名單可改、路人沿用到賽中事件、事件溯源、SSE 計分板、單場統計。
- → **未來（backlog F）**：使用者自建 preset、對手關聯平台球隊（需同意）、聯盟帳號/全站對手來源、成員邀請與 coach/manager 授權。

## 2. 決策摘要（brainstorming 定案）

| 主題 | 決策 |
|---|---|
| M2 是否拆分 | **單一 M2**（writing-plans 時若 >15 task 再拆，同 M3 策略） |
| 規則模型（核心轉向） | `RulePreset`=seeded **基底模板**；建賽**帶入預設值即可改**，**非硬 FK 鎖死**。`Game` 自帶可改規則欄位 |
| Game 規則欄位 | `sportType, matchMode, dhEnabled, epAllowed, rosterSize, reEntryAllowed`（皆可逐場改） |
| DH/EP 判定 | **由名單組成「推導」**：preset 只給「允許 DH/EP」上限；實際依「打序人數、投手是否在打序」推導與驗證 |
| matchMode | `formal`（正式）/ `friendly`（友誼）/ `intra_squad`（對內賽，最寬鬆） |
| sportType（Game） | 帶 team 預設、**可改**；preset 下拉依 `matchMode` 過濾、`sportType` 為軟提示 |
| 對手 | `opponentName` 自由字串；**必填，但 `intra_squad` 可空**；autocomplete=「我自己曾 key 過的對手」+ 模糊查詢 |
| Game 選填欄位 | 地點、**天氣、溫度** |
| gameStatus（M2） | `draft`（草稿）→ `scheduled`（已排定）→ `lineup_confirmed`（名單已確認）；`live` 之後 M3 |
| 名單結構 | `GameRoster`(對 game 1:1) + 多筆 `LineupSlot`；`battingOrder?` / `fieldPosition?` 皆可空 |
| 路人球員 | `LineupSlot` 來源二選一：`playerId`（註冊球員）或 `guestName`（路人，**不入球隊 roster**，僅活在該場） |
| 守位合法值 | 為「驗證用途」定 **per-sportType 守位 enum**；球員資料仍自由字串（不回頭改 M1-B），**選人時不限制** |
| 名單驗證 | rule-engine 純函式 7 條（見 §6）；`friendly`/`intra_squad` 放寬人數與守位齊全 |
| 驗證時機 | 可存草稿（不驗）→ 轉 `lineup_confirmed` 強制驗證 + `POST /roster:validate` 預檢端點 + 前端輕量提醒 |
| 授權 | 一律 **owner-only**（讀亦需 member）；沿用 M1-B `TeamAccessPolicy` |
| 錯誤格式 | 沿用全域 **RFC7807 ProblemDetail**；驗證失敗用 **422** + 違規清單 |
| 多值儲存 | 沿用 Postgres 原生 `text[]`（Hibernate 6 array） |
| 前端 | **全 UI**（建比賽表單 + 比賽列表 + 名單編輯頁 + 驗證顯示）；拖拉排序歸 UI polish |

## 3. 資料模型（Flyway `V3__games_rosters_rules.sql`，4 張新表 + seed）

### rule_preset（seeded 基底模板；非硬 FK，建賽帶入即可改）
| 欄位 | 型別 | 約束 |
|---|---|---|
| preset_id | VARCHAR(40) | PK（如 `baseball-formal-9`） |
| label | VARCHAR(60) | NOT NULL（中文顯示，如「棒球正式賽 9 人」） |
| sport_type | VARCHAR(20) | NOT NULL（baseball/softball_fast/softball_slow/teeball） |
| match_mode | VARCHAR(20) | NOT NULL（formal/friendly/intra_squad） |
| dh_allowed | BOOLEAN | NOT NULL（是否允許 DH） |
| ep_allowed | BOOLEAN | NOT NULL（是否允許 EP） |
| default_roster_size | INT | NOT NULL（預設打序/守備人數基準：棒9、慢壘10） |
| re_entry_allowed | BOOLEAN | NOT NULL（是否允許再上場一次） |
| roster_flex | BOOLEAN | NOT NULL（人數彈性；friendly/intra 為 true） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Seed（6 組，涵蓋 AC-5/6/7）**：

| preset_id | sport_type | match_mode | dh | ep | size | re_entry | flex |
|---|---|---|---|---|---|---|---|
| baseball-formal-9 | baseball | formal | ✗ | ✗ | 9 | ✗ | ✗ |
| baseball-formal-dh | baseball | formal | ✓ | ✗ | 9 | ✗ | ✗ |
| softball-slow-formal-10 | softball_slow | formal | ✗ | ✗ | 10 | ✓ | ✗ |
| softball-slow-formal-ep-11 | softball_slow | formal | ✗ | ✓ | 10 | ✓ | ✗ |
| softball-friendly-ep | softball_slow | friendly | ✗ | ✓ | 10 | ✓ | ✓ |
| teeball-friendly | teeball | friendly | ✗ | ✓ | 9 | ✓ | ✓ |

> 慢壘/快壘友誼共用 `softball-friendly-ep` 一組，靠 `game.sportType` 區分（Q3 定案）。preset 是「複製來源」非硬綁，下拉以 `matchMode` 為主篩、`sportType` 為軟提示，使用者帶入後可任意改。

### games
| 欄位 | 型別 | 約束 |
|---|---|---|
| game_id | UUID | PK |
| team_id | UUID | NOT NULL REFERENCES teams(team_id) |
| sport_type | VARCHAR(20) | NOT NULL（帶 team 預設、可改） |
| match_mode | VARCHAR(20) | NOT NULL（formal/friendly/intra_squad） |
| base_preset_id | VARCHAR(40) | NULL REFERENCES rule_preset(preset_id)（記錄帶入來源，軟參照） |
| dh_enabled | BOOLEAN | NOT NULL |
| ep_allowed | BOOLEAN | NOT NULL |
| roster_size | INT | NOT NULL（本場打序/守備人數基準） |
| re_entry_allowed | BOOLEAN | NOT NULL |
| game_date | DATE | NOT NULL |
| home_away | VARCHAR(10) | NOT NULL（home/away） |
| opponent_name | VARCHAR(120) | NULL（formal/friendly 服務層強制必填；intra_squad 可空） |
| venue | VARCHAR(120) | NULL |
| weather | VARCHAR(40) | NULL |
| temperature_c | INT | NULL（攝氏整數） |
| game_status | VARCHAR(20) | NOT NULL DEFAULT 'draft'（draft/scheduled/lineup_confirmed） |
| created_by | UUID | NOT NULL REFERENCES users(user_id) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

索引：`idx_games_team (team_id)`；`idx_games_opponent (team_id, opponent_name)`（對手 autocomplete）。

### game_roster（對 game 1:1，名單容器）
| 欄位 | 型別 | 約束 |
|---|---|---|
| game_roster_id | UUID | PK |
| game_id | UUID | NOT NULL **UNIQUE** REFERENCES games(game_id) |
| confirmed_at | TIMESTAMPTZ | NULL（轉 lineup_confirmed 時填） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### lineup_slot
| 欄位 | 型別 | 約束 |
|---|---|---|
| slot_id | UUID | PK |
| game_roster_id | UUID | NOT NULL REFERENCES game_roster(game_roster_id) |
| player_id | UUID | NULL REFERENCES players(player_id)（註冊球員） |
| guest_name | VARCHAR(120) | NULL（路人，不入球隊 roster） |
| batting_order | INT | NULL（null=只守不打，DH 制的投手） |
| field_position | VARCHAR(10) | NULL（null=只打不守，DH/EP；值 ∈ 守位 enum） |
| lineup_status | VARCHAR(20) | NOT NULL DEFAULT 'starter'（starter/bench） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| — | — | **CHECK**：`player_id` / `guest_name` 恰一個非空 |

索引：`idx_slot_roster (game_roster_id)`。
> `battingOrder` / `fieldPosition` 皆可空，用「兩個可空欄位」統一表達 9 人/DH/EP（Q9 定案）：`battingOrder=null`→只守不打（DH 的投手）；`fieldPosition=null`→只打不守（DH、EP）。

## 4. 套件結構（package-by-module，沿 backend/CLAUDE.md）

```
com.baseball.record
├── game/
│   ├── Game.java, GameRepository.java
│   ├── GameService.java, GameController.java
│   ├── RulePreset.java, RulePresetRepository.java, RulePresetController.java
│   └── dto/{CreateGameRequest, UpdateGameRequest, GameResponse,
│            RulePresetResponse, OpponentSuggestion}.java
├── lineup/
│   ├── GameRoster.java, GameRosterRepository.java
│   ├── LineupSlot.java, LineupSlotRepository.java
│   ├── LineupService.java, LineupController.java
│   └── dto/{PutRosterRequest, LineupSlotDto, RosterResponse, ValidationResultResponse}.java
└── shared/ruleengine/
    ├── PositionRules.java        # per-sportType 守位 enum + 必要守位集 + 標準守備數
    ├── LineupValidator.java      # 純函式：DH/EP 推導 + 7 條檢查
    ├── LineupView.java / SlotView.java   # 純資料輸入（service 預先解析後傳入）
    └── ValidationResult.java / Violation.java
```

## 5. 規則模型與 DH/EP 推導（核心）

**流程**：選棒/壘 → 選 preset（依 matchMode 過濾）→ 帶入基底值到 Game → 自由開關 `dhEnabled/epAllowed`、調 `rosterSize`、`reEntryAllowed`。preset 之後與 Game 解耦（`base_preset_id` 僅記來源）。

**守位 enum（PositionRules，僅驗證用；M1-B 球員守位仍自由字串）**：

| sportType | 守位集 | 標準守備數 D | 必要守位（formal） |
|---|---|---|---|
| baseball / softball_fast | P, C, 1B, 2B, 3B, SS, LF, CF, RF | 9 | 全 9 個 |
| softball_slow | 上列 + SF（短外野） | 10 | 全 10 個 |
| teeball | 寬鬆（不固定必要集） | 9 | 不強制齊全 |

**DH/EP 由名單推導**（給定先發 slots）：
- `pitcherSlot` = `fieldPosition == 'P'` 的 slot；`pitcherBats` = 該 slot 有 `battingOrder`。
- `battingCount` = 有 `battingOrder` 的 slot 數。
- **hasDH** ⟺ 投手只守不打（pitcherSlot 存在且 `battingOrder=null`）且存在「只打不守」slot 替其打擊。
- **hasEP** ⟺ `battingCount > D`（打序人數超過標準守備數 → 多出的是 EP）。
- 推論落地（Q18）：**棒球 >9 人打擊 = 全 EP**（battingCount>9 → hasEP）；**投手也打 = 無 DH**（pitcherBats → hasDH=false，自動成立）。

驗證時把推導出的 `hasDH/hasEP` 與 Game 的 `dhEnabled/epAllowed` 對照（見 §6 檢查⑤）。

## 6. 名單驗證 rule-engine（`LineupValidator`，純函式）

輸入：`LineupView`（slots + game 規則欄位 + sportType 解析出的 `PositionRules` + 服務層預先解析的「球員是否可出賽」旗標）。輸出：`ValidationResult{ valid, violations[] }`，每筆 `Violation{ code, message, slotRef? }`。

**7 條檢查（逐條對應 unit test，code 對照）**：

| # | 檢查 | violation code | formal | friendly / intra_squad |
|---|---|---|---|---|
| ① | 打序數量符 preset（!ep→`==rosterSize`；ep→`>=rosterSize`） | `BATTING_COUNT_MISMATCH` | ✅ | 放寬（人數彈性，可 8v8/超守備數） |
| ② | 打序連續不重複（恰 1..battingCount，無缺號/重號） | `BATTING_ORDER_INVALID` | ✅ | ✅（基本一致性仍檢） |
| ③ | 必要守位齊全（依守位 enum 必要集） | `REQUIRED_POSITION_MISSING` | ✅ | 放寬（可不齊守位） |
| ④ | 同一守位不重複 | `POSITION_DUPLICATE` | ✅ | ✅ |
| ⑤ | DH/EP 符 Game flags（hasDH→需 dhEnabled；hasEP→需 epAllowed） | `DH_NOT_ALLOWED` / `EP_NOT_ALLOWED` | ✅ | ✅ |
| ⑥ | 投手存在（∃ fieldPosition='P'） | `PITCHER_MISSING` | ✅ | ✅ |
| ⑦ | 註冊球員須屬該隊且可出賽（路人除外） | `PLAYER_NOT_ELIGIBLE` | ✅ | ✅ |

- 放寬規則對應 **AC-7**：`friendly`/`intra_squad` + EP 開放時，登錄/出賽人數可超過正式守備人數、可不齊守位而**不被判非法**（VR-004）；其餘一致性（②④⑤⑥⑦）仍檢。
- 檢查⑦的「可出賽」= `player.team_id == game.team_id` 且 `roster_status != archived` 且 `availability != unavailable`；此資料庫判定在 `LineupService` 先解析成旗標傳入，保持 validator 純函式。

## 7. 授權（沿用 M1-B）

- 全 M2 端點需有效 JWT（`@AuthenticationPrincipal UUID userId`，沿 `JwtAuthFilter`）。
- **寫**（建/改比賽、PUT 名單、確認、validate）→ `TeamAccessPolicy.requireRole(userId, teamId, OWNER)`。
- **讀**（列表、取單場、roster、對手 autocomplete）→ `requireMember`（非成員 404，隱藏存在性）。
- `GET /api/games/{gameId}` 等非巢狀於 team 的端點：Service 先載 game → 取 `game.teamId` → 再跑 policy。

## 8. API（REST，ProblemDetail 錯誤）

### 規則集（seeded 基底模板）
| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| GET | `/api/rule-presets?sportType=&matchMode=` | 登入者 | 回基底模板清單（以 matchMode 篩、sportType 軟提示）→ 200 |

### 比賽
| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| POST | `/api/teams/{teamId}/games` | owner | body=建賽欄位（含帶入後可改的規則）；建立 → **201** `GameResponse`，狀態 `scheduled`（AC-4） |
| GET | `/api/teams/{teamId}/games` | member | query `?status=`；回我隊比賽列表 → 200 |
| GET | `/api/games/{gameId}` | member | → 200 `GameResponse` |
| PATCH | `/api/games/{gameId}` | owner | 部分更新欄位 **與**狀態流轉（`gameStatus`）；轉 `lineup_confirmed` 觸發強制名單驗證 → 200 / **422** |
| GET | `/api/teams/{teamId}/opponents?q=` | member | 我曾 key 過的對手名稱（distinct + 模糊）→ 200 `OpponentSuggestion[]` |

### 出賽名單
| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| GET | `/api/games/{gameId}/roster` | member | → 200 `RosterResponse`（slots） |
| PUT | `/api/games/{gameId}/roster` | owner | **覆寫整份名單**（草稿可存、不強制驗）→ 200 `RosterResponse` |
| POST | `/api/games/{gameId}/roster:validate` | member | 預檢，不改狀態 → 200 `ValidationResultResponse` |

**狀態流轉（PATCH gameStatus）**：允許 `scheduled ↔ draft`、`scheduled → lineup_confirmed`、`lineup_confirmed → scheduled`（解鎖再編）。`→ lineup_confirmed` 前跑 §6 驗證：不合法 → **422 ProblemDetail**（`properties.violations` 帶違規清單，AC-6），不改狀態；合法 → 設 `confirmed_at` + 狀態 `lineup_confirmed`（AC-5）。

**ValidationResultResponse**：`{ valid: boolean, violations: [{ code, message, slotRef? }] }`。

**PutRosterRequest**：`{ slots: [{ playerId?, guestName?, battingOrder?, fieldPosition?, lineupStatus }] }`（每 slot 恰一個 playerId/guestName）。PUT 為整份覆寫（刪舊 slots、寫新 slots），草稿階段不驗合法性，但仍做基本輸入驗證（恰一來源、enum 值域）。

## 9. 前端（全 UI、沿 M1-B tokens / react-router）

- 路由新增：
  - `/teams/:teamId` 球隊頁加「比賽」區塊（列表 + 建比賽入口）。
  - `/teams/:teamId/games/new` 建比賽表單。
  - `/games/:gameId` 比賽詳情 + 名單編輯 + 驗證顯示。
- `api/client.ts` 擴充：`rulePresets.list`、`games.list/create/get/update`、`opponents.suggest`、`roster.get/put/validate`。
- 元件：
  - **CreateGameForm**：sportType（帶 team 預設可改）、matchMode、preset 下拉（選後**帶入**規則值）、`dhEnabled/epAllowed/rosterSize/reEntryAllowed` 可調、日期、主/客、對手（autocomplete + 自由 key；intra_squad 可空）、地點/天氣/溫度選填。
  - **GamesSection**：比賽卡片列表（狀態中文、對手、日期）。
  - **LineupEditor**：slot 表格——每列選註冊球員或加路人、填打序、選守位（下拉=守位 enum）、標 starter/bench；**前端輕量檢查提醒**（打序重複/缺投手等），確認前呼叫 `roster:validate` 顯示完整結果。
  - **ValidationPanel**：列出 violations（中文訊息），合法才允許「確認名單」。
- 顯示繁中；保留無障礙（label、`role=alert`）。

## 10. 輸入驗證（DTO 層）

- `CreateGameRequest`：`sportType`/`matchMode`/`homeAway` 必為對應 enum；`gameDate` @NotNull；`rosterSize` @Min；`opponentName` ≤120（formal/friendly 服務層強制非空，intra_squad 可空）；`venue`/`weather` ≤上限、`temperatureC` 合理範圍。
- `PutRosterRequest`：每 slot 恰一個 `playerId`/`guestName`（400 否則）；`battingOrder` @Min(1)（可空）；`fieldPosition` 若提供須 ∈ 該 sportType 守位 enum；`lineupStatus` ∈ {starter, bench}。
- 違反 → 400 ProblemDetail（含欄位錯誤）；名單**合法性**（§6）→ 422（與輸入驗證分離）。

## 11. 測試與 AC 對應

**L1 單元（`shared/ruleengine`，純函式，無容器）**
- `LineupValidatorTest`：7 條檢查各 pass/fail；DH/EP 推導案例——無 DH（投手打擊、9 人全守）、DH（投手只守、DH 只打）、EP（棒球 10/11 人打擊 >9）、慢壘 formal-10 與 EP-11；friendly/intra 放寬人數與守位齊全但仍抓打序重複/缺投手；teeball 寬鬆。
- `PositionRulesTest`：per-sportType 守位集/必要集/標準守備數正確。

**L2 整合（Spring Boot Test + Testcontainers over Podman，每條對一 AC）**
- `RulePresetControllerIT`：seed 6 組可列、`matchMode` 篩選正確。
- `GameControllerIT`：建賽→201 + 狀態 `scheduled`（**AC-4**）；preset 帶入後可改；sportType 預設 team、可覆寫；opponent formal 必填 / intra_squad 可空；列表 `?status=` 篩選；GET 單場 member 可、非成員 404；寫端點 owner-only。
- `LineupControllerIT`：PUT 草稿名單不驗可存；`roster:validate` 合法→valid（**AC-5**）、不合法→帶 violations（**AC-6**）；PATCH 轉 `lineup_confirmed` 受驗證 gate（合法才轉、否則 422）；**friendly + EP 人數超守備數仍通過（AC-7）**；路人 slot；球員可出賽性（⑦）。
- `OpponentSuggestIT`：autocomplete distinct + 模糊。

**L3 端到端（Playwright，AC-4~7）**
- 登入 → 建比賽（選 sportType/matchMode/preset → 帶入可改 → 填對手/日期）→ 編合法名單 → 確認通過（AC-4/5）。
- 編不合法名單（缺守位/打序重複/人數不符）→ 顯示原因，無法確認（AC-6）。
- 壘球友誼 + EP：人數超守備數 → 確認通過（AC-7）。

## 12. 對 M1 的影響

- 純新增：Flyway `V3`、`game`/`lineup` 模組、`shared/ruleengine`；**不改 M1-A/M1-B 既有行為與測試**。
- 沿用 `JwtAuthFilter`（principal=UUID）、`SecurityConfig`（新端點落 `authenticated()`）、`TeamAccessPolicy`、全域 ProblemDetail。
- **不回頭改 M1-B 球員 schema**：球員守位維持自由字串；守位 enum 僅存在於 ruleengine 驗證用途。

## 13. 待釐清（已於 brainstorming 解決，無阻塞 open item）

實作時可再展開、不阻塞設計：
- teeball 必要守位集（M2 採寬鬆/friendly-style，不強制齊全）。
- `rosterSize` 與 EP 上限的精確數值門檻（檢查①）——依棒/壘規則於 writing-plans/實作展開（沿 MVP design §12「判定表留實作展開」）。
- `game_date` M2 用 `DATE`（不含時間）；需要開賽時間再加欄位。
- 溫度單位採攝氏整數（`temperature_c`）。