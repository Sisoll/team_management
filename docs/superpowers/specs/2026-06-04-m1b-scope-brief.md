# M1-B 範圍 Brief（球隊 + 球員 + 域內 RBAC）

> 來源：由背景研究 agent 從 `specs/001-baseball-record-platform/spec.md`、`data-model.md`、`docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md` 萃取整理（2026-06-04）。
> 用途：M1-B 之 **brainstorming → design → writing-plans** 前置輸入。本文只「整理 spec 已寫的」，**不做設計決策**。
> 里程碑定位：design §10.5 中 **M1 = 身分 + 球隊基礎**；M1-A（登入）已完成，M1-B = 球隊 + RBAC schema + 球員 CRUD。對應 **AC-2 / AC-3**。

## 1. Entities & 欄位

### Team（球隊）
| 欄位 | 型別 | 約束 | 關聯 | M1-B |
|---|---|---|---|---|
| teamId | PK | — | — | Core |
| teamName | String | 必填 | — | Core |
| sportType | Enum | baseball / softball | — | Core（建立時選） |
| teamStatus | Enum | active/inactive/archived | — | Defer（MVP 簡化） |
| createdAt | Timestamp | — | — | Core |
| owners[] | FK[] | 擁有者 | UserAccount via TeamMembership | M1-B（建立者為初始 owner） |
| members[] | FK[] | 成員+角色 | TeamMembership | M1-B（僅列出；管理 UI 延後） |
| players[] | FK[] | 球員名單 | PlayerProfile | M1-B |
| calendarViews[] | FK[] | 行事曆 | TeamCalendarEntry | **OUT（後續里程碑）** |

### TeamMembership（球隊成員）
| 欄位 | 型別 | 約束 | 關聯 | M1-B |
|---|---|---|---|---|
| membershipId | PK | — | — | Core |
| teamId | FK | — | Team | Core |
| userId | FK | — | UserAccount | Core |
| roles[] | Enum[] | 可多選：owner/manager/coach/scorer/member/staff | — | M1-B（schema + 基本檢查；管理 UI 延後） |
| membershipStatus | Enum | active/inactive/suspended | — | Defer |

- **角色可多重指派**（同一人可同時是 coach + scorer）；權限由角色「集合」計算，非單一層級。
- 依賴：需 UserAccount（M1-A）+ Team（M1-B）。

### PlayerProfile（球員）
| 欄位 | 型別 | 約束 | 關聯 | M1-B |
|---|---|---|---|---|
| playerId | PK | — | — | Core |
| teamId | FK | 非空 | Team | Core |
| displayName | String | 必填 | — | Core |
| uniformNumber | Int | 同隊內唯一 | — | Core |
| linkedUserId? | FK(nullable) | 選擇性連結帳號 | UserAccount | M1-B（僅 schema，連結流程延後） |
| linkedMembershipId? | FK(nullable) | — | TeamMembership | M1-B（僅 schema） |
| accountLinkStatus | Enum | unlinked/pending/linked | — | M1-B（僅 schema） |
| primaryPositions[] | Enum[] | 主守位 | — | Core |
| secondaryPositions[] | Enum[] | 次守位 | — | Core |
| rosterStatus | Enum | active/inactive/suspended/graduated | — | Core |
| historyRecords[] | FK[] | **append-only** 變更歷史 | PlayerHistory | M1-B（schema + CRUD 觸發；歷史 UI 延後） |
| createdAt / updatedAt | Timestamp | — | — | Core |

- ⚠️ **歷史 append-only**：背號 / 守位 / rosterStatus 變更時 MUST 新增歷史節點、**絕不覆寫**（VR-013）。

## 2. 功能需求（FR）
**球隊 / 成員**
- FR-007 球隊建立、基本資料維護、狀態管理 → Core
- FR-002 平台角色 + 球隊角色兩層權限 → Core（M1-B 做 schema + 基本檢查）
- FR-003 一使用者可屬多隊、可同隊多角色 → Core（schema + API）
- FR-004 owner/manager 邀請成員 → **OUT（延後）**
- FR-005 被授權者設定/變更角色 → **OUT（延後）**
- FR-006 限制未授權者存取 → Core（API 層 JWT + 角色檢查）
- FR-006A/B/C 補登修正 / 臨時紀錄權限 → **OUT（M2/M3）**

**球員**
- FR-008 建立維護球員 → Core（CRUD）
- FR-008A 無帳號也能建球員（linkedUserId nullable）→ Core（schema）
- FR-009 記錄背號/守位/在隊/可出賽狀態 → Core
- FR-010 保留變更歷史（非只最新）→ Core（append-only）
- FR-011 依在隊狀態/守位篩選 → Core（API filter）
- FR-012 區分成員與球員（隊職員不一定是球員）→ Core（schema）
- FR-012A 球員可事後補連結帳號 → Core（schema）
- FR-013 比賽/名單只納入符合條件球員 → Core（query；M2 用）

## 3. 驗收（AC-2 / AC-3）
**AC-2 球隊**：登入者建立球隊（名稱+球種）→ 儲存、自動指派建立者為 owner、回傳 teamId + status=active、可立即管理。多隊使用者於列表看到全部所屬球隊（FR-001D/003）。

**AC-3 球員**（owner 已登入球隊）：
- 3.1 新增：名稱/背號/主守位/在隊狀態 → 儲存、背號同隊唯一、不要求帳號、回傳 playerId
- 3.2 編輯：改背號/守位/在隊狀態 → 新增歷史（原值→新值+時間）、append-only、可查完整脈絡（VR-010）
- 3.3 刪除：已出賽（有 GameEvent）禁刪或警告；未出賽允許軟刪（rosterStatus=archived）/硬刪；刪除仍留歷史
- 3.4 列出：GET `/api/teams/{teamId}/players` 回全部球員（含 status/最新背號守位），支援 `?rosterStatus=active&positions=CF` 篩選

## 4. RBAC（域內、存 DB）
- **平台角色**（後續）：Platform Admin。
- **球隊角色**（TeamMembership.roles[]）：owner / manager / coach / scorer / member / staff。
- **M1-B 簡化**：design §6.5「owner 全包」→ M1-B **存完整角色 schema，但只強制 owner**；其餘角色權限留待 member-management 階段擴充。
- **強制方式**：JWT → userId → 查 {userId, teamId} 的 TeamMembership → 取 roles[] → policy 檢查。**無角色階層表，由角色集合計算**（如含 owner 或 manager 則允許球員 CRUD）。
- M1-B 重點端點守衛：建立球隊（任何登入者）；球員 CRUD（M1-B 限 owner）；讀球隊（該隊任一角色）。

## 5. 對 M1-A 的依賴
- TeamMembership.userId → UserAccount（M1-A）。
- 建立球隊者（JWT 的 userId）自動成 owner。
- 所有 team/player 端點需有效 JWT + 角色檢查。
- 執行序：M1-A 登入✓ → M1-B 球隊+RBAC schema → 球員 CRUD（owner-only）。

## 6. 待釐清（brainstorming 種子）
1. **多 owner**？spec 允許多角色，但 MVP「owner 全包」似為單 owner — M1 是否支援多 owner 或延後。
2. 成員邀請流程（誰能邀、email/連結/審核）— 延後，下階段定義。
3. 球員歷史查詢 UI 時程。
4. teamStatus 生命週期（何時 inactive/archived）。
5. 球員帳號連結（事後 claim）流程時程。
6. **守位 enum 實際清單**（C/P/SS/CF…）— spec 未列舉，建議 M2 名單時定。
7. 球員軟刪 vs 硬刪規則（無事件可硬刪？有事件只軟刪？）— spec 無明文，建議軟刪保歷史。
8. 背號跨季重用 / 是否有 season 維度（M1 無）。
9. **M1-B 角色粒度**：實作全部 6 角色或只 owner？建議「存完整 schema、只強制 owner」。
10. linkedMembershipId 是否由 linkedUserId+teamId 推導（避免循環）。

## 7. 明確 OUT of M1-B（後續里程碑）
行事曆 / 出賽通知報名 / 成員邀請與角色管理 UI / 球員帳號連結流程 / 球員歷史時間線 UI / 累積統計戰績(M3) / 比賽與裁定(M2) / 公開分享層級(M3) / 臨時紀錄權限申請。

## 8. M1-B 完成定義
1) 建立球隊（名稱+球種）2) 建立者自動 owner 3) owner 可 CRUD 球員（名稱/背號/守位/狀態）4) 球員歷史 append-only 5) RBAC schema（roles[]+檢查）就位 6) API 強制 owner-only 7) linkedUserId nullable 存在、連結延後 8) 多隊支援。**驗收 = AC-2 + AC-3。**

### 關鍵實作約束
- 球員歷史 **append-only、絕不覆寫**（VR-013）。
- 角色多重指派；權限由集合計算、非階層。
- 授權檢查 **全在 DB**（JWT + 角色查詢），不外包外部 auth。
- linkedUserId/linkedMembershipId nullable，M1-B 僅 schema。
