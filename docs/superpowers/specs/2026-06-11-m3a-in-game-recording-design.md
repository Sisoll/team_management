# M3a 設計：賽中記錄引擎（寫端）

> 里程碑 **M3a**（MVP design §10.5 將最重的 M3 拆為 M3a 寫端 + M3b 讀端）。
> 對應 **AC-8（賽中記錄）/ AC-9（再上場驗證）/ AC-11（補登修正重算）**。
> 前置：M1（auth/球隊/球員/RBAC）、M2（建比賽/規則/出賽名單/名單驗證）已完成並 merge `main`。
> 本檔為 brainstorming（2026-06-11，含視覺 companion）產出的設計事實來源；實作計畫見後續 `docs/superpowers/plans/`。
> 來源：MVP design §6、`specs/001-baseball-record-platform/`（FR-022~028、VR-002/003/007）、`docs/superpowers/backlog.md` §E。

## 1. 範圍與目標

讓紀錄員在開賽後：**開賽 → 逐打席記錄（結果＋逐球好壞球可選＋跑者處理）→ 賽中換人/再上場（規則驗證）→ 即時看場面狀態（比分/出局/壘包/在場）→ 補登/修正並自動重算 → 結束比賽**。**全端**：後端事件溯源 REST API + 純函式 event-fold / scoring rule-engine + React 記錄/時間線 UI + Playwright E2E。

**M3a 交付 = 寫端一條龍**：能記完整一場、撤銷/修正重算、即時取當前狀態（`GET /state`）。

**明確 OUT of M3a**（→ M3b 或後續 slice）：
- **M3b（讀端）**：SSE 即時計分板 `/stream`、單場 box score（打擊/投球統計）、line score 統計 API、計分板/數據 UI。
- **後續獨立 slice（backlog §E 進階賽中動態）**：中途取消/啟用 DH、EP↔守備員中途對調、名單人數中途增減（遲到加人/傷退減人）、打序中途增減、傷退無補→自動出局。
- **記錄詳細度層級**：M3a 交付 **L2（乾淨結果）＋逐球好壞球（可選）**；架構內建 level/對稱概念，**L1（純好壞球、手動切棒）、L3（含守備位置）、對稱具名記錄對手**為緊接增量，非 M3a 必交付。

## 2. 決策摘要（brainstorming 定案）

| 主題 | 決策 |
|---|---|
| M3 拆分 | **M3a 寫端**（事件溯源/記錄/換人/再上場/修正重算/狀態機 + 記錄·時間線 UI）→ **M3b 讀端**（SSE 計分板 + 單場統計） |
| 記錄粒度 | **打席結果 ＋ 逐球好壞球（可選）＋ 投球數**；非完整 pitch-by-pitch（不記球種/落點/每球順序） |
| 詳細度 level | **L1** 只好壞球（手動切棒）/ **L2** 乾淨結果 H·BB·K·GO·FO（自動切棒）/ **L3** ＋守備位置（LFO·2BG…）。**M3a 主交付 L2**；開賽選一次、不中途切 |
| 投球數歸屬 | **投手**（守備半局才記）；打擊卡不放投球數。好球可分 揮空/站著 的計數 |
| 對手記錄 | 預設**對手打者匿名**逐打席記（驅動壘包/出局/比分/我方投手 line）；**對稱具名**為 option（M3a 不必交付） |
| 事件粒度 | **一個打席 = 一筆 composite `GameEvent`**（payload 含結果/好壞球/跑者去向/outs/score/bases）。換人/再上場/手動調壘各自獨立事件 |
| 記錄 UX（5 改良） | ① 結果優先、逐球可選　② 詳細度開賽選一次　③ 壘包鑽石可點調跑者　④ 全域撤銷鍵　⑤ 一點結果自動推進＋跳下一棒 |
| 跑者處理 | 結果記完若壘上有人 → 可點鑽石逐一處理（留原壘/→指定壘/得分/壘間出局）；強迫進壘（保送等）自動建議＋確認 |
| 狀態推導 | 場面狀態 = 事件流「摺疊」推導（單一事實來源）；每筆寫入存 `snapshotAfter` 加速讀取與 M3b |
| 修正重算 | 撤銷=移除最後一筆事件並重算；補登/修正=改某筆→**從該點重算後續快照**（VR-007/AC-11） |
| 狀態機 | `lineup_confirmed → live → paused ↔ live → completed`；沿用 `PATCH /api/games/{id}` |
| 授權 | 沿用 M2：寫 owner-only、讀需 member；錯誤 RFC7807，非法換人→422 + 違規清單 |
| 多值/JSONB | payload/basesAfter/snapshotAfter 用 Postgres `JSONB`；relatedPlayers 用 `uuid[]` |

## 3. 記錄 UX（前端核心，沿 M2 tokens / react-router）

### 3.1 開賽設定（一次）
轉 `live` 時要求紀錄員選：**詳細度**（L1 快速 / **L2 標準（預設）** / L3 詳細）、**是否對稱記對手打者**（預設否）。存於 game（見 §6 `recording_detail`、`symmetric_opponent`）。賽中不中途切（避免心智負擔）。

### 3.2 打席主畫面（`記錄` 分頁）
- **即時狀態列**：比分、局/上下、出局、**可點壘包鑽石**。
- **當前對象**：進攻半局＝現在打者（打序#、背號、名字）；守備半局＝對手打者（匿名，或對稱開啟時具名）＋**我方投手區塊**（用球數、`B/S` 球數、可選 `好球▾(揮空/站著)`/`壞球`）。投球數/好壞球僅在守備半局出現（投手是我方球員）。
- **結果面板**（依 level 長對）：L2＝`1B 2B 3B HR / BB HBP K FC / 滾地GO 飛球FO 犧飛 犧短 失誤E`；L3 多一層守備位置選擇。
- **動作列**：代打/代跑/守位/換投、**⤺ 撤銷**。
- **流程**：（可選逐球點好壞球→累加用球數，滿 4 壞自動保送 / 3 好自動三振）→ 點結果 → 無跑者直接完成跳下一棒；有跑者彈**鑽石跑者處理**（點跑者→點目的地；強迫進壘預亮）。

### 3.3 時間線（`時間線` 分頁）
事件流逐筆列出（局/上下、打者、結果中文、跑者變化、換人），支援**修正/刪除**某筆→觸發重算（AC-11）。手動調壘亦走鑽石。

### 3.4 client 擴充
`api/client.ts` 加 `games.start/pause/complete`（PATCH 狀態）、`events.create/list/update/delete`、`game.state`。

## 4. 套件結構（package-by-module，沿 backend/CLAUDE.md）

```
com.baseball.record
├── scoring/                       # M3a 新模組
│   ├── GameEvent.java, GameEventRepository.java
│   ├── ScoringService.java        # 寫事件 + 觸發 fold/重算 + 換人驗證橋接
│   ├── ScoringController.java      # events CRUD + /state
│   └── dto/{RecordEventRequest, EventResponse, GameStateResponse, SubstitutionRequest}.java
├── game/  (既有)                  # 擴充 gameStatus 流轉 live/paused/completed + 開賽設定欄位
└── shared/
    ├── eventfold/                 # M3a 新：純函式
    │   ├── GameStateFolder.java   # 事件流 → GameState（比分/出局/壘包/在場/打序游標/用球數）
    │   ├── GameState.java         # 不可變快照模型（亦序列化成 snapshotAfter JSONB）
    │   └── EventApplier.java      # 單一事件 apply 到 state（fold 的 reducer）
    └── ruleengine/  (既有擴充)
        └── SubstitutionValidator.java  # 換人/再上場合法性（純函式，含 VR-002/003 再上場追蹤）
```

## 5. 事件模型（事件溯源核心）

### 5.1 事件分類（`eventType`）
- **打席結果（PA，composite）**：`SINGLE/DOUBLE/TRIPLE/HOME_RUN`、`WALK/HIT_BY_PITCH`、`STRIKEOUT`、`GROUND_OUT/FLY_OUT/FIELDERS_CHOICE/SAC_FLY/SAC_BUNT/REACH_ON_ERROR`。
- **換人**：`PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY`。
- **跑壘/手動調壘**：`BASE_RUNNING`（盜壘/暴投進壘/牽制出局/跑者修正，payload 描述每位跑者去向）。
- 局數推進（3 出局換半局）**由 fold 推導**，不存獨立事件。

### 5.2 `GameEvent`（append-only；Flyway `V4__game_events.sql`）
| 欄位 | 型別 | 說明 |
|---|---|---|
| event_id | UUID | PK |
| game_id | UUID | NOT NULL REFERENCES games(game_id) |
| inning | INT | NOT NULL（1 起） |
| half | VARCHAR(10) | NOT NULL（top/bottom） |
| sequence_no | INT | NOT NULL（全場單調遞增，定義事件順序與重算起點） |
| event_type | VARCHAR(30) | NOT NULL（見 §5.1） |
| actor_player_id | UUID | NULL（進攻打者；守備半局匿名對手＝null） |
| related_players | UUID[] | NULL（代打/代跑被換者、投手、受影響跑者…） |
| payload | JSONB | NOT NULL（結果細節：好壞球/用球數·守位·跑者去向[]·對手具名 name?） |
| score_delta | INT | NOT NULL DEFAULT 0（本事件得分變化） |
| outs_after | INT | NOT NULL（0–3，本事件後出局數） |
| bases_after | JSONB | NOT NULL（`{first,second,third}` 跑者參照/匿名 token，本事件後壘包） |
| snapshot_after | JSONB | NOT NULL（本事件後完整 `GameState`，加速讀取/計分板） |
| capture_source | VARCHAR(20) | NOT NULL DEFAULT 'manual'（manual；未來 scan/voice） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

索引：`idx_event_game_seq (game_id, sequence_no)`（讀時間線/重算）。

### 5.3 `GameState`（fold 產出 = snapshot 模型）
`{ inning, half, outs, score:{us,opp}, bases:{first,second,third}, battingSide:offense|defense, currentBatterSlotNo?, currentPitcherId?, lineup:[{slotNo,playerId,position,battingOrder,onField,exited,reEntered}], pitcherPitches:{playerId:{pitches,strikes,balls,swinging,looking}}, lineScore:[{inning,top,bottom}] }`。`battingSide` 由 `half + game.homeAway` 推導（我隊 home→bottom 進攻）。

## 6. 資料模型異動

- **`games` 加欄（V4 ALTER）**：`recording_detail VARCHAR(4) NOT NULL DEFAULT 'L2'`、`symmetric_opponent BOOLEAN NOT NULL DEFAULT false`。`game_status` 值域擴充 `live/paused/completed`（既有欄位，無需改型別）。
- **新表** `game_event`（§5.2）。
- M3b 的 `game_stat_line` 等**不在 M3a 建**。

## 7. event-fold 與重算（`shared/eventfold`，純函式）

- `GameStateFolder.fold(events[]) → GameState`：以 `EventApplier.apply(state, event)` 逐筆 reduce 初始狀態（依出賽名單 §M2 GameRoster 建初始打序/守備）。
- **3 出局**→ apply 時自動翻半局、清壘包、出局歸零、line score 收當半局得分。
- **寫入**：`ScoringService` 取目前 state → 算新 event 的 `score_delta/outs_after/bases_after` → 存 event 並把 `fold` 後的 `GameState` 寫入該筆 `snapshot_after`。
- **撤銷**：刪除 `sequence_no` 最大的事件 → 以剩餘事件重算（或直接回退到前一筆 snapshot）。
- **修正/補登（AC-11/VR-007）**：`PATCH`/`POST` 改動某 `sequence_no` 的事件 → **從該 seq 起重算後續所有事件的 snapshot**（純函式重跑，逐筆覆寫 snapshot_after）。重算為 service 層交易內完成。

## 8. scoring rule-engine（`SubstitutionValidator`，純函式）

輸入：當前 `GameState.lineup` + `game.reEntryAllowed` + 嘗試的換人動作。輸出：`ValidationResult{valid, violations[]}`（沿 M2 `Violation{code,message}`）。

| 檢查 | code | 說明 |
|---|---|---|
| 被換者在場 | `SUB_TARGET_NOT_ON_FIELD` | 代打/代跑/守位/換投對象須目前在場 |
| 代打/代跑接手打序 | `SUB_SLOT_MISMATCH` | 接手者承接該打序 slot |
| 守位不重複 | `POSITION_DUPLICATE` | 守位調整後同守位不得兩人（沿 M2 PositionRules） |
| **再上場規則（VR-002/003）** | `RE_ENTRY_NOT_ALLOWED` / `RE_ENTRY_ALREADY_USED` | `reEntryAllowed=false`→任何再上場非法；true→每位先發限一次，追蹤 `exited/reReentered` 旗標 |
| 投手存在 | `PITCHER_MISSING` | 換投後仍須有投手 |

> 進階（中途 DH/EP 變形、人數增減、打序增減）**不在 M3a**，validator 預留擴充點但不實作。

## 8.5 換人對 fold 的影響
換人事件 apply 後更新 `lineup`（在場球員/守位/旗標）。`RE_ENTRY` 設回 `onField=true,reReentered=true`；被換下者 `onField=false,exited=true`。後續打席用更新後 lineup 推導當前打者/投手。

## 9. 授權與錯誤（沿用 M2）

- 全端點需有效 JWT；**寫**（開賽/暫停/結束、events CRUD）→ `TeamAccessPolicy.requireRole(OWNER)`；**讀**（state/timeline）→ `requireMember`。
- 非巢狀於 team 的端點先載 game 取 `teamId` 再跑 policy。
- 輸入錯誤→400 ProblemDetail；非法換人/非法狀態流轉→**422/409** + `violations`。

## 10. API（REST，ProblemDetail）

| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| PATCH | `/api/games/{id}` | owner | 狀態流轉 `lineup_confirmed→live`（開賽，帶 recording_detail/symmetric_opponent）/`live↔paused`/`→completed`；非法流轉 409 |
| POST | `/api/games/{id}/events` | owner | 記一筆事件（PA/換人/跑壘）；body=`RecordEventRequest`；service 算 delta/outs/bases + 寫 snapshot → 201 `EventResponse`；非法換人 422 |
| GET | `/api/games/{id}/events` | member | 事件時間線（依 sequence_no）→ 200 `EventResponse[]` |
| PATCH | `/api/games/{id}/events/{eventId}` | owner | 修正某事件 → 從該 seq 重算 → 200 |
| DELETE | `/api/games/{id}/events/{eventId}` | owner | 刪除（撤銷/補登）→ 重算 → 200/204 |
| GET | `/api/games/{id}/state` | member | 當前 `GameStateResponse`（最後一筆 snapshot 或空狀態）→ 200 |

> SSE `/stream`、`/box-score` 屬 **M3b**，本里程碑不實作。

## 11. 測試與 AC 對應

**L1 單元（`shared/eventfold` + `shared/ruleengine`，純函式，無容器）**
- `GameStateFolderTest`：PA 各結果對壘包/得分/出局推導；3 出局翻半局；line score 累計；逐球好壞球累加用球數；強迫進壘。
- `EventApplierTest`：單事件 apply 正確性（含換人更新 lineup）。
- `SubstitutionValidatorTest`：5 條檢查各 pass/fail；**再上場 VR-002/003**——不允許時任何再上場非法、允許時限一次、第二次 `RE_ENTRY_ALREADY_USED`。

**L2 整合（Spring Boot Test + Testcontainers over Podman，每條對一 AC）**
- `ScoringControllerIT`：開賽流轉（lineup_confirmed→live）；記一連串 PA → `/state` 比分/壘包/出局正確（**AC-8**）；換人含再上場合法/非法 422（**AC-9**）；**修正/刪除某事件→後續 snapshot 與 state 依重算更新**（**AC-11**）；owner-only / member 讀。

**L3 端到端（Playwright，AC-8/9/11）**
- 登入→建賽→確認名單→開賽→記數打席（含一次代打、一次再上場）→看狀態列即時更新→修正一筆→時間線與狀態同步更新。

## 12. 對既有里程碑的影響

- 純新增：Flyway `V4`、`scoring` 模組、`shared/eventfold`、`shared/ruleengine` 擴充（`SubstitutionValidator`）、前端 `記錄/時間線` 分頁。
- `game` 模組擴充 `gameStatus` 流轉與兩個開賽欄位；**不改 M2 既有 `draft/scheduled/lineup_confirmed` 行為與測試**。
- 沿用 `JwtAuthFilter`、`SecurityConfig`、`TeamAccessPolicy`、全域 ProblemDetail、`PositionRules`。
- **不回頭改 M1/M2 schema 與已驗收行為**（除 bug）。

## 13. 假設與待釐清（不阻塞設計，writing-plans/實作時展開）

- 各結果對「自動跑者推進」的預設規則表（保送強迫、安打預設推進壘數）——實作時依棒/壘常規展開，UI 仍可手動覆寫（鑽石）。
- ER（自責分）判定 MVP 簡化（先以失誤前/後粗判或全計 R，精算留 M3b 統計細化）。
- L1 純好壞球模式「手動切棒」對 fold 的最小事件表示（M3a 以 L2 為主，L1 緊接補）。
- 對手匿名跑者在 `bases_after` 的 token 表示（用序號 token，不需 player 參照）。
