# M1-B 設計：球隊 + 球員 + 域內 RBAC

> 里程碑 M1-B（design §10.5 之 M1 後半）。對應 **AC-2（球隊）/ AC-3（球員）**。
> 前置：M1-A（登入/JWT）已完成。範圍 brief 見 [`2026-06-04-m1b-scope-brief.md`](2026-06-04-m1b-scope-brief.md)。
> 本檔為 brainstorming 產出的設計事實來源；實作計畫見後續 `docs/superpowers/plans/`。

## 1. 範圍與目標

建立球隊（名稱+球種）→ 建立者自動成 owner → 列出我所屬球隊 → 在球隊內對球員做 CRUD（owner-only）並保留 append-only 變更歷史。**全端**：後端 REST API + React 全 UI + Playwright E2E。

**OUT of M1-B**（後續里程碑）：成員邀請/角色管理 UI、帳號連結流程、行事曆/通知、比賽與名單（M2）、統計戰績（M3）、teamStatus 生命週期、刪除球隊。

## 2. 決策摘要（brainstorming 結論）

| 主題 | 決策 |
|---|---|
| RBAC 範圍 | 存完整 6 角色 schema，M1-B **只強制 owner** |
| 授權機制 | service 層顯式：`shared/authorization` 的 **TeamAccessPolicy** |
| sportType | enum：`baseball` / `softball_fast` / `softball_slow` / `teeball`；**建立後不可改** |
| teamName | **不**強制唯一 |
| teamStatus | M1-B 只用 `active` |
| owner 模型 | 建隊時自動建一筆 `TeamMembership(roles=[owner])` |
| 球員刪除 | **軟刪**（roster_status=archived，保留資料與歷史） |
| 守位 | `string[]`，後端不硬驗 enum；前端依 sportType 給建議清單 |
| uniformNumber | `VARCHAR(10)`、可空、**不唯一**（支援 '00'） |
| 球員狀態 | 兩欄位：`rosterStatus`（在隊）+ `availability`（可出賽） |
| 歷史模型 | **變更差異列** PlayerHistory（field/old/new/by/at），append-only（VR-013） |
| 入歷史欄位 | 背號、primary/secondary 守位、roster_status（**不含** availability、displayName） |
| 建立必填 | 只 `displayName`（其餘預設） |
| 多值儲存 | **Postgres 原生陣列 TEXT[]**（Hibernate 6 array 映射；若有摩擦退 @ElementCollection） |
| API 形狀 | 巢狀於 teams |
| 錯誤格式 | 全域 **RFC7807 ProblemDetail**（一併套用 M1-A） |
| 列表查詢 | 篩選（rosterStatus/position/includeArchived），**不分頁** |
| 前端 | 全 UI，新增 `react-router-dom` 導覽 |
| 帳號連結 | 僅 schema 欄位，無流程 |
| 成員管理 | 無；每隊只有建立者 owner |

## 3. 資料模型（Flyway `V2__teams_players_rbac.sql`，4 張新表）

### teams
| 欄位 | 型別 | 約束 |
|---|---|---|
| team_id | UUID | PK |
| team_name | VARCHAR(120) | NOT NULL |
| sport_type | VARCHAR(20) | NOT NULL；值 ∈ {baseball, softball_fast, softball_slow, teeball} |
| team_status | VARCHAR(20) | NOT NULL DEFAULT 'active' |
| created_by | UUID | NOT NULL REFERENCES users(user_id) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### team_memberships
| 欄位 | 型別 | 約束 |
|---|---|---|
| membership_id | UUID | PK |
| team_id | UUID | NOT NULL REFERENCES teams(team_id) |
| user_id | UUID | NOT NULL REFERENCES users(user_id) |
| roles | TEXT[] | NOT NULL（值 ∈ TeamRole；如 `{owner}`） |
| membership_status | VARCHAR(20) | NOT NULL DEFAULT 'active' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| — | — | **UNIQUE(team_id, user_id)** |

索引：`idx_membership_user (user_id)`（查「我的球隊」）。

### players
| 欄位 | 型別 | 約束 |
|---|---|---|
| player_id | UUID | PK |
| team_id | UUID | NOT NULL REFERENCES teams(team_id) |
| display_name | VARCHAR(120) | NOT NULL |
| uniform_number | VARCHAR(10) | NULL（不唯一） |
| primary_positions | TEXT[] | NOT NULL DEFAULT '{}' |
| secondary_positions | TEXT[] | NOT NULL DEFAULT '{}' |
| roster_status | VARCHAR(20) | NOT NULL DEFAULT 'active'（active/inactive/graduated/archived） |
| availability | VARCHAR(20) | NOT NULL DEFAULT 'available'（available/injured/unavailable） |
| linked_user_id | UUID | NULL REFERENCES users(user_id) |
| linked_membership_id | UUID | NULL REFERENCES team_memberships(membership_id) |
| account_link_status | VARCHAR(20) | NOT NULL DEFAULT 'unlinked'（unlinked/pending/linked） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

索引：`idx_players_team (team_id)`。

### player_history（append-only）
| 欄位 | 型別 | 約束 |
|---|---|---|
| history_id | UUID | PK |
| player_id | UUID | NOT NULL REFERENCES players(player_id) |
| field | VARCHAR(40) | NOT NULL（uniform_number/primary_positions/secondary_positions/roster_status） |
| old_value | TEXT | NULL |
| new_value | TEXT | NULL |
| changed_by | UUID | NOT NULL REFERENCES users(user_id) |
| changed_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

索引：`idx_history_player (player_id, changed_at)`。**只 INSERT，永不 UPDATE/DELETE。**

## 4. 套件結構（package-by-module）

```
com.baseball.record
├── team/
│   ├── Team.java, TeamRepository.java
│   ├── TeamMembership.java, TeamMembershipRepository.java
│   ├── TeamService.java, TeamController.java
│   └── dto/{CreateTeamRequest, UpdateTeamRequest, TeamResponse}.java
├── player/
│   ├── Player.java, PlayerRepository.java
│   ├── PlayerHistory.java, PlayerHistoryRepository.java
│   ├── PlayerService.java, PlayerController.java
│   └── dto/{CreatePlayerRequest, UpdatePlayerRequest, PlayerResponse, PlayerHistoryResponse}.java
└── shared/authorization/
    ├── TeamRole.java                 # OWNER, MANAGER, COACH, SCORER, MEMBER, STAFF
    └── TeamAccessPolicy.java         # requireRole / membership lookup
```

## 5. 授權（shared/authorization）

- `TeamRole` enum：OWNER, MANAGER, COACH, SCORER, MEMBER, STAFF（schema 全存，M1-B 只強制 OWNER）。
- `TeamAccessPolicy`：
  - `requireMember(userId, teamId)`：無 membership → **404**（隱藏資源存在性）。
  - `requireRole(userId, teamId, TeamRole.OWNER)`：無 membership → 404；有但 roles 不含 OWNER → **403**。
  - `myTeams(userId)`：回使用者有 membership 的球隊。
- 呼叫點：各 Service 方法開頭。`principal` 為 `UUID`（沿用 M1-A `JwtAuthFilter`）。
- M1-B 規則：**讀**球隊/球員 → requireMember；**寫**（建/改/刪球員、改球隊）→ requireRole(OWNER)。（M1-B 只存在 owner membership，故非-owner 的 403 路徑理論上不會被觸發，但 policy 仍實作以利未來擴充。）

## 6. API（REST，巢狀，ProblemDetail 錯誤）

所有端點需有效 JWT。錯誤統一 RFC7807（見 §9）。

### 球隊
| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| POST | `/api/teams` | 登入者 | body `{teamName, sportType}`；建 team + 一筆 `TeamMembership(roles=[owner])`；→ **201** `TeamResponse`（含 `myRoles`） |
| GET | `/api/teams` | 登入者 | 回我所屬球隊清單 → 200 |
| GET | `/api/teams/{teamId}` | member | → 200 `TeamResponse`（含 myRoles）；非成員 404 |
| PATCH | `/api/teams/{teamId}` | owner | body `{teamName?}`（sportType 不可改）→ 200 |

### 球員（皆需 owner；讀亦需 member）
| 方法 | 路徑 | 授權 | 行為 |
|---|---|---|---|
| POST | `/api/teams/{teamId}/players` | owner | body `{displayName, uniformNumber?, primaryPositions?, secondaryPositions?, rosterStatus?, availability?}`；只 displayName 必填 → 201 `PlayerResponse`（**建立不寫歷史**） |
| GET | `/api/teams/{teamId}/players` | member | query `?rosterStatus=&position=&includeArchived=false`；position 比對 primary 或 secondary；預設排除 archived → 200 清單（不分頁） |
| GET | `/api/teams/{teamId}/players/{playerId}` | member | → 200 `PlayerResponse` |
| PATCH | `/api/teams/{teamId}/players/{playerId}` | owner | 部分更新；tracked 欄位變更 → 寫歷史；可將 archived 改回 active → 200 |
| DELETE | `/api/teams/{teamId}/players/{playerId}` | owner | **軟刪**：roster_status=archived + 寫一筆歷史 → 204 |
| GET | `/api/teams/{teamId}/players/{playerId}/history` | member | → 200 歷史清單（changed_at desc） |

## 7. 歷史機制

`PlayerService.update(...)`：載入現況 → 對 tracked 欄位（uniform_number、primary_positions、secondary_positions、roster_status）逐欄比對舊/新值，**每個有變更的欄位** append 一筆 `player_history{field, old_value, new_value, changed_by=當前 userId, changed_at=now}`。陣列欄位以正規化字串入庫（排序後逗號連接）。軟刪（DELETE）視為 roster_status → archived 的變更，同樣寫一筆。`player_history` 僅 INSERT（VR-013）。

## 8. 前端（全 UI、design tokens、react-router）

- 新增 `react-router-dom`；路由：`/`（我的球隊列表 + 建立球隊）、`/teams/:teamId`（球員名單頁）。登入狀態沿用 M1-A（token + `/api/auth/me`）；未登入導去登入頁。
- `api/client.ts` 擴充：`teams.list/create/get/update`、`players.list/get/create/update/remove/history`。
- 元件：`TeamsPage`（清單卡片 + 建立表單）、`TeamPage`（球員表格 + 新增/編輯/刪除 modal/inline + 篩選列）。沿用 `auth-card`/`btn`/`auth-input` 樣式與 tokens；新增表格/清單樣式（仍用 tokens）。
- 顯示語言繁中；保留無障礙（label、role=alert）。

## 9. 對 M1-A 的影響

- 全域啟用 RFC7807 ProblemDetail（`spring.mvc.problemdetails.enabled` 或 `@ControllerAdvice`）；M1-A 既有 `ResponseStatusException` 自動產生 ProblemDetail。現有 `AuthControllerIT` 只斷言 status code，不受 body 形狀變更影響。
- 沿用 `JwtAuthFilter`（principal=UUID）、`SecurityConfig`；新端點落在 `anyRequest().authenticated()`，無需改 permitAll 清單。

## 10. 驗證規則（輸入）

- `teamName` @NotBlank ≤120；`sportType` 必為 4 enum 之一。
- `displayName` @NotBlank ≤120；`uniformNumber` ≤10（可空）。
- `rosterStatus`/`availability`（若提供）必為對應 enum 之一。
- `primaryPositions`/`secondaryPositions` 為字串陣列（不驗 enum 值）。
- 違反 → 400 ProblemDetail（含欄位錯誤）。

## 11. 測試與 AC 對應

**後端 IT（Testcontainers over Podman）**
- `TeamControllerIT`：建立→201 + 自動 owner membership；GET 我的球隊只含我所屬；GET 非成員球隊→404；PATCH 改名（owner）；sportType 不可改。
- `PlayerControllerIT`：建立（只 displayName）→201；背號可重複；PATCH 改背號/守位/狀態→產生歷史；軟刪→archived + 歷史；列表預設排除 archived、`includeArchived=true` 含；`?position=` 命中 primary/secondary；GET history append-only。
- `TeamAccessPolicyIT`（或單元）：owner 通過；非成員→404。

**前端 E2E（Playwright，AC-2/AC-3）**
- 登入 → 建立球隊（名稱+球種）→ 進入球隊 → 新增球員 → 編輯背號（列表反映 + 歷史新增）→ 軟刪後預設清單看不到。

## 12. 待釐清（已於 brainstorming 解決，無 open item）

所有 brief 開放問題（多 owner、邀請、守位 enum、背號唯一、軟硬刪、角色粒度、linkedMembershipId 等）已於本設計拍板或明列 OUT。
