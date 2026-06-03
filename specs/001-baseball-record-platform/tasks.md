# 任務清單：棒壘球紀錄平台

**輸入**：來自 `/specs/001-baseball-record-platform/` 的設計文件  
**前置需求**：`plan.md`、`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/`  
**組織原則**：任務依使用者看到的流程分組，先完成首頁、右上角全域操作區、個人/球隊/身分上下文，再往下展開隊務、賽程、賽中記錄、統計與報表

## 格式：`[ID] [P?] [Story] 說明`

- **[P]**：可平行執行（不同檔案、無直接依賴）
- **[Story]**：對應使用者故事標籤（`US1` 到 `US7`）
- 每個任務都包含實際檔案路徑，方便直接執行

## 路徑慣例

- Web 頁面：`pages/`
- APP 畫面：`app/`
- 樣式：`assets/css/`
- 共用邏輯：`assets/js/core/`
- Web 邏輯：`assets/js/web/`
- APP 邏輯：`assets/js/app/`
- Mock 資料：`assets/data/`
- 對話歷程：`chat-history.md`

## Phase 1：建立體驗導向骨架

**目的**：先把「使用者一登入真的會看到什麼」的外殼建立起來，而不是先做模組列表

- [ ] T001 建立 Web 未登入入口殼層與首頁導向骨架於 `pages/index.html`
- [ ] T002 [P] 建立右上角全域操作區、上下文 chip 與首頁版型樣式於 `assets/css/tokens.css`、`assets/css/web.css`、`assets/css/app.css`
- [ ] T003 建立 Web / APP 共用啟動流程、頁面初始化與路由輔助於 `assets/js/core/router.js`、`assets/js/web/common.js`、`assets/js/app/common.js`
- [ ] T004 [P] 建立多球隊、多身分、預設個人視角的使用者與球隊展示資料於 `assets/data/users.json`、`assets/data/teams.json`
- [ ] T005 [P] 建立行事曆首頁、個人成績、賽程、比賽與分享展示資料於 `assets/data/calendar.json`、`assets/data/games.json`、`assets/data/events.json`、`assets/data/share-tiers.json`
- [ ] T006 更新需求來源與任務追蹤紀錄於 `chat-history.md`

---

## Phase 2：建立共享上下文與規則核心

**目的**：完成所有故事都會用到的 shared context、權限過濾、規則驗證與統計投影

- [ ] T007 實作個人/球隊/身分上下文狀態管理於 `assets/js/core/mock-store.js`
- [ ] T008 [P] 實作未選球隊限制、球隊切換與身分切換權限判斷於 `assets/js/core/permission-engine.js`
- [ ] T009 [P] 實作個人統計與球隊統計的投影/重算核心於 `assets/js/core/stats-engine.js`
- [ ] T010 [P] 實作棒球/壘球與正式賽/友誼賽的規則模板切換核心於 `assets/js/core/rule-engine.js`
- [ ] T011 實作無後端的 mock 資料載入、重設與情境切換於 `assets/js/core/data-loader.js`
- [ ] T012 建立 Web 右上角全域操作區與 APP 共用摘要列的 shared rendering 於 `assets/js/web/common.js`、`assets/js/app/common.js`
- [ ] T013 串接首頁、統計、隊務與賽程頁對 shared context 的同步反映於 `assets/js/core/mock-store.js`、`assets/js/web/common.js`、`assets/js/app/common.js`

**Checkpoint**：完成後，所有頁面都能辨識目前是「個人視角」還是「某支球隊 + 某個身分」

---

## Phase 3：使用者故事 1 - 登入、首頁行事曆與上下文切換（優先度：P1）

**目標**：讓使用者登入後先看到行事曆首頁，並從右上角完成登入、管理、球隊切換、身分切換與個人成績入口

**獨立驗證方式**：只靠 `pages/index.html`、`pages/auth.html`、`pages/calendar.html`、`pages/teams.html`、`pages/stats.html`、`app/login.html`、`app/home.html` 即可完成首頁登入、個人視角、球隊切換、身分切換與個人成績入口驗證

- [ ] T014 [P] [US1] 建立 Web 未登入首頁與登入導向體驗於 `pages/index.html` 與 `assets/js/web/common.js`
- [ ] T015 [P] [US1] 建立登入頁與登入後導向流程於 `pages/auth.html` 與 `assets/js/web/auth.js`
- [ ] T016 [P] [US1] 建立登入後預設進入的行事曆首頁於 `pages/calendar.html` 與 `assets/js/web/calendar.js`
- [ ] T017 [P] [US1] 建立右上角登入/帳號/管理/球隊切換/身分切換互動於 `pages/index.html`、`pages/calendar.html`、`assets/js/web/common.js`
- [ ] T018 [P] [US1] 建立球隊治理入口、邀請與角色矩陣展示於 `pages/teams.html` 與 `assets/js/web/teams.js`
- [ ] T019 [P] [US1] 建立 APP 登入與首頁摘要畫面於 `app/login.html`、`app/home.html`、`assets/js/app/login.js`、`assets/js/app/common.js`
- [ ] T020 [US1] 串接預設個人視角、未選球隊限制與管理入口 gating 於 `assets/js/core/mock-store.js`、`assets/js/core/permission-engine.js`、`assets/js/web/common.js`
- [ ] T021 [US1] 建立個人視角可直接查看個人成績的入口與空/限制狀態於 `pages/stats.html`、`assets/js/web/stats.js`、`pages/calendar.html`

**Checkpoint**：使用者一登入就能先看到個人行事曆，且不需先選球隊也能看到自己的個人成績；球隊資料則需切換球隊後才開放

---

## Phase 4：使用者故事 2 - 球員資料與歷史管理（優先度：P1）

**目標**：完成球員名單、歷史紀錄、可用狀態與帳號連結的管理與查閱流程

**獨立驗證方式**：只靠 `pages/players.html` 與 `app/lineup.html` 即可新增球員、維護歷史、設定帳號連結並在 APP 查閱可用球員

- [ ] T022 [P] [US2] 建立球員名單、篩選與歷史時間線頁面於 `pages/players.html` 與 `assets/js/web/players.js`
- [ ] T023 [P] [US2] 建立 APP 可用球員與名單查閱畫面於 `app/lineup.html` 與 `assets/js/app/lineup.js`
- [ ] T024 [P] [US2] 補齊未綁定帳號、後續補綁、離隊回隊與不可出賽情境資料於 `assets/data/players.json`、`assets/data/users.json`
- [ ] T025 [US2] 實作球員歷史節點、帳號連結與可用狀態篩選邏輯於 `assets/js/core/mock-store.js`、`assets/js/web/players.js`
- [ ] T026 [US2] 串接球隊上下文切換後的球員資料切換與空狀態提示於 `pages/players.html`、`app/lineup.html`、`assets/js/core/permission-engine.js`

**Checkpoint**：只靠 US2 相關頁面即可在正確球隊上下文內管理球員資料，並保留完整歷史與連結關係

---

## Phase 5：使用者故事 3 - 比賽建立、規則集與出賽名單（優先度：P1）

**目標**：完成比賽建立、規則切換、先發/替補配置與名單合法性驗證

**獨立驗證方式**：只靠 `pages/games.html` 與 `pages/lineup.html` 即可建立比賽、切換規則模式、安排先發與替補並驗證合法性

- [ ] T027 [P] [US3] 建立比賽建立與規則摘要頁面於 `pages/games.html` 與 `assets/js/web/games.js`
- [ ] T028 [P] [US3] 建立先發打序、守位與替補規劃頁面於 `pages/lineup.html` 與 `assets/js/web/lineup.js`
- [ ] T029 [P] [US3] 補齊棒球/壘球、正式賽/友誼賽、DH/EP/再上場與動態人數情境資料於 `assets/data/games.json`、`assets/data/players.json`
- [ ] T030 [US3] 實作規則模板切換、名單合法性驗證與錯誤提示於 `assets/js/core/rule-engine.js`、`assets/js/web/games.js`、`assets/js/web/lineup.js`
- [ ] T031 [US3] 同步已確認名單與規則摘要到 APP 賽前畫面於 `app/game-center.html`、`app/lineup.html`、`assets/js/app/game-center.js`

**Checkpoint**：只靠 US3 相關頁面即可建立一場合法可開賽的比賽，並把規則與名單脈絡帶到 APP

---

## Phase 6：使用者故事 4 - 球隊與個人賽程行事曆、通知與報名（優先度：P1）

**目標**：完成球隊/個人雙行事曆、通知、出賽回覆與人數統計流程

**獨立驗證方式**：只靠 `pages/calendar.html`、`app/home.html`、`app/schedule.html` 即可查看個人賽程、球隊賽程、通知與出賽回覆摘要

- [ ] T032 [P] [US4] 擴充 Web 行事曆首頁為個人/球隊雙視角賽程頁於 `pages/calendar.html` 與 `assets/js/web/calendar.js`
- [ ] T033 [P] [US4] 建立 APP 個人賽程、通知與快速回覆畫面於 `app/schedule.html`、`app/home.html`、`assets/js/app/schedule.js`
- [ ] T034 [P] [US4] 補齊通知、截止時間、參加/不參加/待定/未回覆與外部通道保留情境資料於 `assets/data/calendar.json`、`assets/data/notifications.json`、`assets/data/attendance-responses.json`
- [ ] T035 [US4] 實作個人賽程、球隊賽程、回覆摘要與人數統計投影於 `assets/js/core/mock-store.js`、`assets/js/core/permission-engine.js`
- [ ] T036 [US4] 串接未選球隊時只顯示個人賽程、選球隊後才顯示球隊賽程與統計於 `pages/calendar.html`、`app/home.html`、`app/schedule.html`

**Checkpoint**：只靠 US4 相關頁面即可完成個人日常查看賽程與球隊管理者查看球隊賽程的完整差異

---

## Phase 7：使用者故事 5 - APP 賽中即時事件紀錄（優先度：P1）

**目標**：完成 APP 賽中事件記錄、比分/壘包/出局同步更新、換人與臨時紀錄權限展示

**獨立驗證方式**：只靠 `app/game-center.html`、`app/event-entry.html`、`app/scoreboard.html`、`app/substitutions.html` 即可連續記錄事件並看到場上狀態變化

- [ ] T037 [P] [US5] 建立即時記錄主流程頁面於 `app/game-center.html`、`app/event-entry.html`、`app/scoreboard.html`、`assets/js/app/game-center.js`、`assets/js/app/event-entry.js`
- [ ] T038 [P] [US5] 建立換人、代打、代跑與再上場操作頁面於 `app/substitutions.html` 與 `assets/js/app/substitutions.js`
- [ ] T039 [P] [US5] 補齊逐筆事件、captureSource、待確認事件、友誼賽動態人數與臨時紀錄權限情境資料於 `assets/data/events.json`、`assets/data/games.json`
- [ ] T040 [US5] 實作事件寫入前確認、時間線推導、計分板重算與規則驗證於 `assets/js/core/stats-engine.js`、`assets/js/core/rule-engine.js`、`assets/js/app/event-entry.js`
- [ ] T041 [US5] 實作臨時紀錄權限申請、審核狀態與未授權封鎖於 `app/game-center.html`、`assets/js/app/game-center.js`、`assets/js/core/permission-engine.js`

**Checkpoint**：只靠 US5 相關畫面即可完整展示從開賽到換人的賽中記錄流程

---

## Phase 8：使用者故事 6 - Web 補登修正、統計查詢與公開分享（優先度：P2）

**目標**：完成 Web 補登修正、個人成績/球隊成績查詢、公開切換與分享檢視

**獨立驗證方式**：只靠 `pages/review.html`、`pages/stats.html`、`pages/share.html`、`app/share-preview.html` 即可修正事件、查看個人或球隊統計並驗證分享範圍

- [ ] T042 [P] [US6] 建立賽事回顧與事件修正頁面於 `pages/review.html` 與 `assets/js/web/review.js`
- [ ] T043 [P] [US6] 重構統計頁為個人視角/球隊視角雙模式查詢頁於 `pages/stats.html` 與 `assets/js/web/stats.js`
- [ ] T044 [P] [US6] 建立分享管理與分享檢視頁面於 `pages/share.html`、`app/share-preview.html`、`assets/js/web/share.js`、`assets/js/app/share-preview.js`
- [ ] T045 [US6] 實作補登修正後的時間線回放、個人統計與球隊統計重算於 `assets/js/core/stats-engine.js`、`assets/js/web/review.js`、`assets/js/web/stats.js`
- [ ] T046 [US6] 實作個人視角只看自己成績、球隊視角看球隊統計與 A/B/C 分享層級過濾於 `assets/js/core/permission-engine.js`、`assets/data/share-tiers.json`、`pages/stats.html`、`pages/share.html`

**Checkpoint**：只靠 US6 相關頁面即可驗證球員在個人視角看自己的成績，而管理者在球隊視角看球隊統計與分享設定

---

## Phase 9：使用者故事 7 - 戰績分類、特殊結果與區間報表（優先度：P2）

**目標**：完成分類戰績、特殊結果裁定、合併視圖與區間報表展示

**獨立驗證方式**：只靠 `pages/stats.html` 與 `pages/reports.html` 即可切換分類、區間、戰績納入規則與報表輸出模式

- [ ] T047 [P] [US7] 建立分類戰績與區間報表頁面於 `pages/reports.html` 與 `assets/js/web/reports.js`
- [ ] T048 [P] [US7] 擴充統計頁的分類篩選、合併模式與特殊結果摘要控制於 `pages/stats.html` 與 `assets/js/web/stats.js`
- [ ] T049 [P] [US7] 補齊延賽、棄賽、對手棄權、違規判勝負與預設不納入戰績情境資料於 `assets/data/games.json`、`assets/data/events.json`
- [ ] T050 [US7] 實作戰績納入邏輯、3 個月/1 年/自訂區間報表與分類合併模式於 `assets/js/core/stats-engine.js`、`assets/js/web/stats.js`、`assets/js/web/reports.js`

**Checkpoint**：只靠 US7 相關頁面即可驗證球隊管理者如何切換報表與戰績規則

---

## Final Phase：整理與跨故事驗證

**目的**：完成首頁導覽、驗證路徑、文件對齊與整體展示品質收斂

- [ ] T051 [P] 對齊 Web 首頁導覽、右上角全域操作區與情境入口說明於 `pages/index.html`、`pages/calendar.html`、`assets/js/web/common.js`
- [ ] T052 [P] 對齊 APP 首頁、個人賽程與賽後摘要入口說明於 `app/home.html`、`app/schedule.html`、`assets/js/app/common.js`
- [ ] T053 [P] 依新版使用者流程更新快速驗證步驟與 smoke checklist 於 `specs/001-baseball-record-platform/quickstart.md`、`specs/001-baseball-record-platform/checklists/requirements.md`
- [ ] T054 [P] 對齊 Web / APP 體驗與合約定義於 `specs/001-baseball-record-platform/contracts/web-ui-contract.md`、`specs/001-baseball-record-platform/contracts/app-ui-contract.md`
- [ ] T055 驗證最終範圍、成功標準、需求追溯與需求歷程紀錄於 `specs/001-baseball-record-platform/plan.md`、`specs/001-baseball-record-platform/quickstart.md`、`specs/001-baseball-record-platform/checklists/requirements.md`、`chat-history.md`

---

## 依賴關係

- Phase 1 必須先完成，才能建立以首頁與上下文為核心的展示骨架。
- Phase 2 必須先完成，才能讓所有頁面共享相同的個人/球隊/身分上下文與統計投影。
- US1 是所有後續頁面的前置條件，因為後續功能都依賴登入後首頁、球隊切換與身分切換。
- US2 依賴 US1 的當前球隊上下文。
- US3 依賴 US2 的球員名單與 US1 的球隊治理/切換能力。
- US4 依賴 US1 的首頁與上下文切換，以及 US3 的比賽建立資料。
- US5 依賴 US3 的名單與規則設定。
- US6 依賴 US1 的個人/球隊視角切換與 US5 的事件資料。
- US7 依賴 US6 的統計查詢基礎與 US3/US5 的完整比賽資料。

## 建議完成順序

1. Phase 1：建立體驗導向骨架
2. Phase 2：建立共享上下文與規則核心
3. Phase 3：US1 登入、首頁行事曆與上下文切換
4. Phase 4：US2 球員資料與歷史管理
5. Phase 5：US3 比賽建立、規則集與出賽名單
6. Phase 6：US4 球隊與個人賽程行事曆、通知與報名
7. Phase 7：US5 APP 賽中即時事件紀錄
8. Phase 8：US6 Web 補登修正、統計查詢與公開分享
9. Phase 9：US7 戰績分類、特殊結果與區間報表
10. Final Phase：整理與跨故事驗證

## 平行執行範例

### US1

- T014、T015、T016 可平行，因為未登入首頁、登入頁與首頁主體分屬不同檔案。
- T018 可與 T019 平行，因為 Web 隊務頁與 APP 首頁摘要檔案不同。

### US2

- T022 與 T023 可平行，因為 Web 球員頁與 APP 查閱頁檔案不同。
- T024 可與 T022/T023 平行，因為資料情境擴充不依賴 UI 完成。

### US3

- T027 與 T028 可平行，因為比賽建立頁與名單頁分屬不同檔案。
- T029 可與 T027/T028 平行，因為規則與名單情境資料可先整理。

### US4

- T032 與 T033 可平行，因為 Web 行事曆與 APP 賽程頁檔案不同。
- T034 可與 T032/T033 平行，因為通知與回覆資料情境可獨立準備。

### US5

- T037 與 T038 可平行，因為即時記錄主流程與換人流程檔案不同。
- T039 可與 T037/T038 平行，因為事件與授權資料可先建立。

### US6

- T042、T043、T044 可平行，因為回顧頁、統計頁、分享頁分屬不同檔案。
- T045 需在事件與統計頁主體完成後整合。

### US7

- T047 與 T048 可平行，因為報表頁與統計頁擴充檔案不同。
- T049 可與 T047/T048 平行，因為特殊結果與區間資料可先整理。

## 實作策略

### MVP 優先順序

1. 先完成 Phase 1 與 Phase 2，建立首頁導向、shared context、規則與統計核心。
2. 以 US1 → US2 → US3 → US4 → US5 完成使用者可實際操作的 MVP 主閉環。
3. 再以 US6 → US7 補上賽後修正、個人成績/球隊統計、分享與報表。

### 增量交付建議

1. 先交付「像真實產品」的首頁與切換體驗：US1。
2. 再交付隊務與比賽前置資料：US2、US3。
3. 接著交付使用者每天會用到的賽程與回覆：US4。
4. 再交付核心價值流程：US5。
5. 最後補齊賽後回顧、個人成績、球隊統計、分享與報表：US6、US7。
