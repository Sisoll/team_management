# Backlog — 之後再補

> **原則**：M1（AC-1/2/3）已驗收並 merge 進 master。已驗收的行為契約**凍結，除非是 bug**；新需求往前走，走 `brainstorming → design → plan`，不回頭改「M1」。
> **分類**：`bug`（現在修）/ `ui-polish`（視覺，批次做）/ `enhancement`（新需求，需 design、常含 migration）/ `tech-debt`。
> 做下一個里程碑前掃一遍本檔，決定哪些併入、哪些獨立做。

## A. M1 UI 補完（小、前端為主，可優先快做）

- [ ] **守備位置編輯 UI** — 後端 `PATCH /api/teams/{id}/players/{pid}` 已支援改 primary/secondary 守位（並寫歷史），但前端 `TeamPage` 目前只有「改背號／封存」。補一個球員編輯表單（守位、狀態、名稱、availability）。屬 *gap，非新功能*，低風險。
- [ ] **背號基本驗證（只允許數字）** — 前端 `<input inputmode="numeric" pattern="\d*">`＋後端 `@Pattern("^\\d{1,10}$")`。⚠️ **維持字串型別**以保留 `'00'`／`'0'` 區別，不要改成整數（會撞到當初「不唯一、字串」決策）。

## B. 資料欄位強化（新需求，需 design + migration V3）

- [ ] **暱稱** — 先釐清是「球員暱稱」還是「使用者暱稱」（或都要）。schema 新欄位 + DTO + UI。
- [ ] **聯絡資訊（球隊 / 個人）** — 球隊聯絡方式、球員/使用者聯絡方式（電話、email…）。可能用獨立 contact 結構。schema + UI。需考量隱私（誰能看）。

## C. UI 視覺 polish pass（美化，一次處理全部頁面）

- [ ] **整體美化** — 登入 / 球隊列表 / 球員名單頁太單調。走 **Claude Design**（餵 `frontend/src/tokens.css`：暖米＋球場綠）→ 產設計 → handoff Claude Code 實作。建議所有頁面一起做、風格統一。

## D. Tech-debt（來自 M1-B code review）

- [ ] `TeamPage` 用 `prompt()`/`confirm()` → 改成 modal 元件（可及性、不阻塞主執行緒）
- [ ] `TeamService.myTeams` 用 `findAllById`（無排序）→ 球隊列表加穩定排序
- [ ] `PlayerHistoryResponse` 可回傳 `changedBy`（多人球隊後需要顯示「誰改的」）
- [ ] 球員列表 `includeArchived`/`position` 改 DB 層查詢（目前 Java 端過濾；規模大時優化）
- [ ] `TeamPage.load()` 用 `useCallback` / 取消 in-flight fetch（避免快速切換的 race）
- [ ] 非 owner 403 的 controller 層測試（待 member-invite 里程碑、有非 owner 成員時補）

## E. M3（賽中記錄）需求補充 — 來自 M2 brainstorming（2026-06-08）

> 這些都是「比賽進行中」的動態，屬 **M3（事件溯源／換人）**。M2 只做開賽前的初始名單＋驗證。
- [ ] 賽中換人：代打 / 代跑 / 守位調整 / 投手更換 / 再上場（VR-002/003）
- [ ] 守備員 ↔ EP 中途對調（可跨 n 局切換）
- [ ] 中途取消 DH（投手取得打席、原 DH 下場）／中途啟用 DH
- [ ] 名單人數中途增減：有人第二局才到（＋人）、傷退無人可補（－人）
- [ ] 打序中途變多／變少（友誼／對內賽尤其常見）
- [ ] 傷退且無替補 → 該打序「**自動出局**」（M3 計分規則）
- [ ] 賽中名單／守位／換人皆可改（roster 在比賽過程可變）
- [ ] 臨時球員（路人A/B）沿用到賽中事件

## F. 未來（聯盟管理等）— 來自 M2 brainstorming（2026-06-08）

- [ ] 對手關聯成平台球隊（需對方同意）、同步比賽資訊過去
- [ ] 「聯盟帳號」做比賽紀錄
- [ ] 對手下拉的「聯盟分組 / 全站共享」來源（跨帳號資料）
- [ ] 對手名稱跨帳號共享 registry

## G. 成員 · RBAC · 帳號連結 · 申請加入（milestone 級，延後做）— 來自 2026-06-10 討論

> 大部分產品意圖**已在 `specs/.../spec.md` 與 `V2` schema 定義**，非從零。延後到 UI 收尾後再開獨立 milestone（完整 design→plan→實作）。**當前 UI 維持現狀**（球員仍用 inline 新增、owner-only）。POC 階段不需要。

**已被 spec / schema 涵蓋（實作時對齊即可，勿重造）**
- 角色與兩層 RBAC：FR-002/003/005/006；`TeamRole(owner/manager/coach/scorer/member/staff)`、`shared/authorization/TeamAccessPolicy.requireRole`。
- 邀請成員加入球隊：FR-004（owner/manager 邀請）；FR-005 設定角色。
- 球員可選擇性連結帳號、先建資料之後再 link：spec Q&A（誰可記錄那段）、US2-AC3、FR-012；schema `players.linked_user_id / linked_membership_id / account_link_status(預設 unlinked)`。
- 成員/球員狀態欄位：`team_memberships.membership_status`、`players.roster_status / availability`。

**規格尚未涵蓋（此 milestone 要做前需先擴充 spec）**
- [ ] **使用者自助「申請加入」球隊**（現行 spec 為邀請制 FR-004；自助申請是新增）：需球隊探索/搜尋 + 申請→審核；`membership_status` 狀態機補 `applied / invited`。
- [ ] **球員↔帳號連結需「被連結 user 同意」**（consent 方向；spec 只說 manager 連結，未定同意）：`account_link_status`：unlinked→pending(邀請中)→linked / declined。
- [ ] **球員新欄位：暱稱、聯絡方式**（FR-009 未含）＝ 本檔 §B，併入此 milestone 一起 design + migration。

**UI 面（隨此 milestone 一起做，非現在）**
- [ ] 新增/編輯按鈕**依角色顯示**（非 owner 須被授權才看得到）。
- [ ] 球員新增/編輯改 **按鈕→Modal**（取代現有 inline 兩 input）；可編 暱稱/背號/聯絡方式/守位/狀態。
- [ ] 新增球員時可送出「**連結到某 user 帳號**」邀請（待對方同意）。
- [ ] 一般 user「**申請加入球隊**」入口。
- [ ] 球員/成員**狀態徽章**：邀請中 / 申請中 / 已連結 / 在隊 / 封存…

> §B（暱稱/聯絡資訊）併入本節，不再單列。
