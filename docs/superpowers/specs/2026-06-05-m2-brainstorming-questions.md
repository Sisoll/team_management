# M2 Brainstorming — 第一批問題（含建議作法）

> 里程碑 **M2 = 比賽 + 規則集(preset) + 出賽名單 + 名單驗證**，對應 **AC-4/5/6/7**。
> 實體：`Game · RulePreset · GameRoster · LineupSlot`；rule-engine 純函式驗證（VR-001/004/005）。
> 來源：`docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md` §4–§10.5、`specs/001-baseball-record-platform/`。
>
> **怎麼用**：每題我給選項 + ⭐建議。你可以直接「全部照建議」，或逐題在後面標 `→ 改成 X / 註記`。答完我據此提方案 → 寫 M2 design doc。

---

## A. 範圍與規則集

### Q1. M2 要不要拆成 M2a/M2b？
M2 含「建比賽+規則集」與「名單+驗證」兩塊。
- **A) 單一 M2**（⭐建議）— 比賽與名單緊密相關，一個 plan 仍可控（估 10–12 task）。
- B) 拆 M2a（比賽+preset）/ M2b（名單+驗證）。
> 建議理由：先單一 M2；writing-plans 時若 >15 task 再拆，跟 M3 同策略。

### Q2. RulePreset 怎麼提供？
- **A) Flyway seed 平台預設**（⭐建議）— 啟動即有固定幾組，使用者只「選」不「建」。
- B) 使用者/球隊自建 preset。
> 建議理由：MVP 用 seed 最快打通 AC，自建 preset 屬後續強化（YAGNI）。

### Q3. 要 seed 哪些 preset？
建議先 seed 這幾組（⭐）涵蓋 AC-5/6/7：
| presetId | sportType | matchMode | 人數/特性 |
|---|---|---|---|
| baseball-formal-9 | baseball | formal | 9 人、無 DH/EP、再上場關 |
| baseball-formal-dh | baseball | formal | 9 打+DH、再上場關 |
| softball-slow-formal-10 | softball_slow | formal | 10 人、無 EP |
| softball-friendly-ep | softball_fast/slow | friendly | EP、人數彈性開、再上場開 |
| teeball-friendly | teeball | friendly | 彈性、再上場開 |
> 建議理由：5 組足以驗正式/友誼×DH/EP×彈性；細項判定表（各出局/推進）留 M3 實作時展開。
> 待你確認：**慢壘/快壘**是否各需獨立 preset，或 friendly 共用一組？（建議共用 friendly-ep 一組，靠 game.sportType 區分）

### Q4. Game 的 sportType 與 Team 的關係？
- **A) 預設帶入 team.sportType、可改**（⭐建議）
- B) 必須等於 team.sportType
- C) 完全自由
> 建議理由：球隊偶爾打不同賽制；建比賽時帶預設可改最實用。preset 下拉依 `game.sportType + matchMode` 過濾。

---

## B. 比賽 Game

### Q5. M2 實作哪些 gameStatus 轉換？
完整流：`draft → scheduled → lineup_confirmed → live → paused → completed → reviewed`
- **A) M2 只到 `draft → scheduled → lineup_confirmed`**（⭐建議），`live` 之後整段留 M3。
- B) 一路做到 completed。
> 建議理由：live/記錄/計分是 M3 核心，M2 收在「名單確認」最乾淨。

### Q6. 對手怎麼表示？
- **A) `opponentName` 自由字串**（⭐建議）
- B) 對手也是平台球隊（需關聯/邀請）
> 建議理由：MVP 對手多半不在平台；自由字串最簡。

### Q7. 建比賽的必填欄位？
建議（⭐）：**日期、對手名稱、主/客、賽制(matchMode)、規則集**必填；**地點**選填；**sportType** 帶 team 預設可改。
> 待你確認：要不要「對手」也可空（如隊內紅白對抗）？（建議可空，預設必填）

---

## C. 出賽名單 Roster / Lineup

### Q8. 名單資料怎麼存？
- **A) 一張 `GameRoster`（對 game 1:1）+ 多筆 `LineupSlot`**（⭐建議）：slot 有 `playerId, battingOrder?, fieldPosition?, lineupStatus(starter/bench)`。
- B) 全塞 JSONB。
> 建議理由：依 data-model；關聯式利於驗證查詢與未來換人。bench 用 `lineupStatus` 區分。

### Q9. 打序與守位的關係（DH/EP 結構）怎麼建模？— 核心複雜點
情境：無 DH=9 人既打又守；DH=投手不打、DH 替打 → 9 打序+投手(無打序)=10 人；EP=額外打者，打序>守位數。
- **A) 每個 LineupSlot 的 `battingOrder` 與 `fieldPosition` 皆可為 null**（⭐建議）：
  - `battingOrder=null` → 只守不打（DH 制的投手）
  - `fieldPosition=null` → 只打不守（DH、EP）
  - rule-engine 依 preset 檢查兩者組合合法性。
- B) 固定 9 格、DH/EP 用額外欄位特例處理。
> 建議理由：A 用「兩個可空欄位」統一表達 9/DH/EP，模型最簡、驗證最一致。

### Q10. 守位的合法值（驗證需要）？
M1-B 球員守位是**自由字串**；但名單驗證 VR-005「守位缺漏」需要知道「必要守位集」。
- **A) M2 為「驗證用途」定義 per-sportType 標準守位 enum**（⭐建議）：棒球 `P/C/1B/2B/3B/SS/LF/CF/RF`(+DH)；慢壘加 `SF`(短外野)；樂樂依規則。球員資料**仍可自由字串**，只有名單驗證收斂到這組。
- B) 維持完全自由、名單不驗守位齊全（只驗人數/打序）。
> 建議理由：要做 AC-6（守位缺漏報錯）就需要 A 的守位集；範圍限「驗證用」，不回頭改 M1-B 球員欄位。

---

## D. 名單驗證 rule-engine

### Q11. 名單驗證要檢查哪些（VR-001/005）？
建議（⭐）這 6 條，逐條對應 unit test：
1. 打序數量符合 preset（9 / 10 / +EP）
2. 打序連續不重複（1..N）
3. 必要守位都有人（依 Q10 守位集）
4. 同一守位不重複
5. DH/EP 規則符合 preset（沒開 DH 不可有「只打不守」者；沒開 EP 不可有額外打者）
6. 投手存在
> 待你確認：要不要也檢查「球員屬於該隊且 rosterStatus 可出賽」？（建議要，避免排到別隊/已封存球員）

### Q12. 友誼賽彈性（VR-004 / AC-7）放寬到什麼程度？
- **A) friendly + EP：放寬「人數上限」與「守位齊全」**（⭐建議）— 可超過守備人數、可不齊守位；仍檢查打序不重複等基本一致性。
- B) 只放寬人數上限、仍要求守位齊全。
> 建議理由：AC-7 明示「人數可超過正式守備人數而不被判非法」，A 最貼。

### Q13. 驗證時機？
- **A) 可存草稿（不驗）；轉 `lineup_confirmed` 時強制驗證 + 另有 `POST /roster:validate` 預檢端點**（⭐建議）
- B) 每次存都驗、不合法不能存。
> 建議理由：對應 AC-5（合法可確認）/AC-6（不合法報原因）；草稿階段不擋使用者編輯。

---

## E. 授權與前端

### Q14. M2 前端做到哪？＋ 授權
授權：沿用 M1-B，**建比賽/編名單一律 owner-only**（⭐建議；coach/manager 留後續）。
前端：
- **A) 全 UI**（⭐建議）：建比賽表單 + 比賽列表 + 名單編輯頁（排打序/選守位/標 starter|bench）+ 驗證結果顯示 → 可 E2E 驗 AC-4~7。名單編輯先用**簡單表單/下拉**，拖拉排序留到 UI polish。
- B) API + 最小 UI。
> 建議理由：延續 M1 全端風格、能端到端驗收；拖拉等花俏互動歸 polish pass。

---

## 附：我預設會這樣鎖的小事（有異議再說）
- API 沿 design §7：`/api/teams/{teamId}/games`、`/api/games/{id}`、`PATCH /api/games/{id}`（狀態）、`PUT /api/games/{id}/roster`、`POST /api/games/{id}/roster:validate`。
- 錯誤格式沿用 RFC7807 ProblemDetail。
- Flyway `V3` 建 game/rule_preset/game_roster/lineup_slot 表 + seed preset。
- rule-engine 放 `shared/ruleengine`（純函式，大量 unit test）。
- 多值欄位（守位等）沿用 Postgres `text[]`。
- E2E：建比賽 → 編合法名單 → 確認通過；編不合法名單 → 顯示原因（AC-5/6）。

---

# 第二批問題（依你 2026-06-08 的答覆衍生）

> 你的答覆把「規則模型」改得更彈性，並帶出路人球員、對內賽等新點。以下 6 題定案後就寫 M2 design。
> 賽中動態（換人/±人/取消DH/傷退自動出局）已記到 `backlog.md` E 段（M3）；對手聯盟/全站關聯記到 F 段（未來）。

## Q15. 規則設定模型（重要）
你的 Q3 把「固定 preset 只能選」改成「選棒/壘→帶入基底→自由開關 DH/EP、人數彈性」。
- **A) Game 自帶規則欄位**（⭐建議）：`sportType, matchMode, dhEnabled, epAllowed, rosterSize(或上限), reEntryAllowed`。`RulePreset` 改為 **seeded「基底模板」**，建賽時**帶入預設值即可改**，不做硬 FK 鎖死。
- B) 維持固定 preset FK、不可逐場改。
> 建議理由：A 才能滿足你要的「帶入後可加減 DH/EP、人數彈性」。

## Q16. matchMode 列舉確認
建議（⭐）：`formal`(正式) / `friendly`(友誼) / `intra_squad`(對內賽)。對內賽驗證最寬鬆（可不填對手、人數最彈性，比照甚至寬於友誼）。確認？

## Q17. 臨時/路人球員怎麼進名單？
Q11 提到借來的人沒註冊（路人A/B）。
- **A) LineupSlot 支援兩種來源**（⭐建議）：`playerId`(註冊球員) 或 `guestName`(臨時，如「路人A」)；guest **不寫入球隊 roster**、只活在該場名單（之後沿用到 M3 賽中事件）。
- B) 一律先幫他建一個 guest 球員（污染 roster）。
> 建議理由：A 不污染球隊名單，最貼「臨時借人」情境。

## Q18. 「棒球超過9人打擊＝全EP、投手也打＝無DH」怎麼落地？
- **A) DH/EP 狀態由名單組成「推導」**（⭐建議）：preset 只給「是否允許 DH／EP」上限；實際是 DH 還是 EP、有沒有 DH，由「打序人數、投手是否在打序」推導與驗證。
- B) DH/EP 當成使用者手動旗標、不自動推導。
> 確認 A 的理解對嗎？（這會影響 rule-engine 驗證邏輯）

## Q19. 對手下拉的 M2 範圍
- **A) M2 只做「我自己曾 key 過的對手名稱」autocomplete＋模糊查詢**（⭐建議）；「聯盟分組／全站共享」因牽涉跨帳號與聯盟管理 → 歸未來 F 段。
- B) M2 就要做聯盟/全站分組。
> 建議理由：跨帳號資料與聯盟概念屬後面版本，M2 先做自己歷史對手即可達 AC-4。

## Q20. gameStatus 中文（你 Q5 要的）
給你這套對照，描述你之後再定：

| code | 中文 | M2 是否實作 |
|---|---|---|
| draft | 草稿 | ✅ |
| scheduled | 已排定 | ✅ |
| lineup_confirmed | 名單已確認 | ✅ |
| live | 進行中 | M3 |
| paused | 暫停 | M3 |
| completed | 已完成 | M3 |
| reviewed | 已複核 | M3 |

> 確認中文 + 「M2 只到 名單已確認」？

## 另記：名單在賽中可改
你補充「名單在比賽過程中可改（換守位/換人）」= M3 範疇，已記 backlog E 段。M2 的名單是「開賽前設定 + 驗證」，賽中變動屬 M3 事件。

---

# ✅ M2 定案彙整（2026-06-08；第一批含 nuance + 第二批照建議；可直接據此寫 design）

**範圍**：M2 = 建比賽 + 規則設定 + 出賽名單 + 名單驗證（AC-4/5/6/7）。單一 M2。gameStatus M2 只到 `lineup_confirmed`（名單已確認）。

**規則模型（核心轉向）**
- `RulePreset` = seeded **基底模板**（baseball-formal-9 / baseball-formal-dh / softball-slow-formal-10 / 11人(EP) / softball-friendly-ep / teeball-friendly），建賽時**帶入預設值即可改**，非死綁。
- `Game` 自帶**可改規則欄位**：`sportType, matchMode, dhEnabled, epAllowed, rosterSize(或上限), reEntryAllowed`。
- 流程：選棒/壘 → 帶入基底 → 自由開關 DH/EP、人數彈性。
- **DH/EP 由名單組成推導**：preset 只給「允許 DH/EP」上限；實際依「打序人數、投手是否在打序」判定。棒球 >9 人打擊 = 全 EP；投手也打 = 無 DH。
- `matchMode` = `formal`(正式) / `friendly`(友誼) / `intra_squad`(對內賽)。

**Game 欄位**
- `sportType` 帶 team 預設可改。
- 必填：日期、主/客、matchMode、規則（帶入）；**對手必填，但 `intra_squad` 可不填**。
- 選填：地點、**天氣、溫度**。
- 對手輸入：自由 key + **autocomplete（自己曾 key 過的對手）+ 模糊查詢**；聯盟/全站來源 → 未來（backlog F）。

**Roster / Lineup**
- `GameRoster`(對 game 1:1) + 多筆 `LineupSlot`：`battingOrder?, fieldPosition?, lineupStatus(starter|bench)`，order/position 皆可空。
- `LineupSlot` 來源二選一：`playerId`(註冊球員) 或 `guestName`(路人A，**不入球隊 roster**，僅活在該場)。
- 守位驗證用「**固定 per-sportType 守位 enum**」（棒 P/C/1B/2B/3B/SS/LF/CF/RF(+DH)；慢壘 +SF…）；**選人時不限制**（可路人、可無資訊）。

**名單驗證（rule-engine，純函式）**
- 檢查：① 打序數量符 preset ② 打序連續不重複 ③ 必要守位齊全（依守位 enum）④ 守位不重複 ⑤ DH/EP 符 preset ⑥ 投手存在 ⑦ 註冊球員須屬該隊且可出賽（路人除外）。
- `friendly` / `intra_squad` 放寬：人數彈性（8v8、可超守備數）、可不齊守位；仍檢查打序不重複等基本一致性。
- 時機：可存草稿(不驗) → 轉 `lineup_confirmed` 強制驗證 + `POST /roster:validate` 預檢端點 + **前端輕量檢查提醒**。

**授權 / 前端**
- 一律 **owner-only**。
- **全 UI**：建比賽表單 + 比賽列表 + 名單編輯頁（排打序/選守位/標 starter|bench/加路人）+ 驗證結果顯示。E2E 驗 AC-4~7。

**延後（已記 backlog）**
- → **M3（backlog E）**：賽中換人(代打/代跑/守位/投手/再上場)、EP↔守備中途對調、中途取消/啟用 DH、中途±人(第二局才到/傷退)、棒次中途增減、**傷退無補→自動出局**、賽中名單可改、路人沿用到賽中。
- → **未來（backlog F）**：對手關聯平台球隊(需同意)、聯盟帳號做紀錄、對手下拉聯盟/全站來源。
