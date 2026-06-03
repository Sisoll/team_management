# 實作計畫：棒壘球紀錄平台

**分支**：`001-baseball-record-platform` | **日期**：2026-03-26 | **來源**：[spec.md](./spec.md)  
**輸入**：`/specs/001-baseball-record-platform/spec.md`

**注意**：本計畫以靜態前端雛型為交付目標，所有畫面與互動皆以前端 mock 資料與瀏覽器狀態模擬，不實作後端服務。Prototype 以本機靜態 server 啟動為前提，不支援以 `file://` 直接雙擊 HTML 的方式執行。

## 摘要

本功能規劃一套同時支援 Web 與 APP 介面展示的棒壘球紀錄平台雛型，涵蓋帳號與球隊治理、球員資料、比賽建立、行事曆通知、即時記錄、賽後回顧、統計查詢、區間報表、特殊結果裁定與公開分享。技術策略採多頁靜態網站搭配 APP 模擬畫面，共用一套前端 mock domain model、權限判斷、規則驗證與統計計算模組。

Web 端的展示主軸改為更貼近真實使用情境的「行事曆首頁」：登入後先看到個人行事曆與個人成績入口，再透過右上角全域操作區切換球隊與身分；球隊管理、球隊成績、球隊名單與球隊賽程都必須在選定球隊後才展開。APP 端則承接個人賽程、通知與賽中記錄情境。

本 prototype 目標是支撐後續正式開發，因此保留模組化 JavaScript、共用 core 邏輯與多頁面分工。為避免瀏覽器 `file://` 對 ES Modules 的安全限制，執行方式統一改為「透過本機靜態 server 啟動」。

## 技術背景

**語言／版本**：HTML5、CSS3、JavaScript ES2022  
**主要相依**：Vanilla JavaScript ES Modules、Chart.js（統計圖表展示，可後續接入）、Mermaid（文件圖示，可後續接入）  
**資料來源**：前端 mock 資料、瀏覽器記憶體狀態、必要時以 `localStorage` 保留示範狀態  
**執行方式**：使用本機靜態 server 啟動，不支援 `file://` 直接開啟  
**測試方式**：手動情境驗證、頁面 smoke checklist、JavaScript 語法檢查  
**目標平台**：現代桌面瀏覽器、行動瀏覽器與 APP 介面展示情境  
**專案型態**：多頁靜態網站 + APP 介面展示雛型  
**展示預設**：登入後預設進入個人行事曆首頁；右上角全域操作區負責登入、管理、球隊切換與身分切換；未選球隊時僅顯示個人內容；公開分享採固定 A/B/C 層級；臨時紀錄權限申請僅有待審核/已核准/已拒絕且不做自動逾時；報表預設以分類分開顯示並將特殊結果預設排除於戰績外  
**規模範圍**：11 個 Web 功能模組頁面、9 個 APP 展示畫面、2 種球種模式、2 種賽事模式、3 種公開層級、球隊/個人雙行事曆、分類戰績與區間報表情境

## Prototype 交付約束

1. 所有功能以展示流程順暢、狀態完整可操作為優先，不要求真實後端整合。
2. 執行前提為本機靜態 server；`file://` 直接開啟不屬於支援範圍。
3. 保留 ES Modules 與 shared core 架構，以便後續銜接正式開發。
4. Web 端必須以「行事曆首頁 + 右上角全域操作區」呈現真實使用者的主要入口，而不是以模組清單作為登入後第一視圖。
5. 未選擇球隊時僅呈現個人相關資訊；球隊管理、球隊成績、球隊名單與球隊賽程都需先選定球隊後才開放。
6. 外部通知/報名通道與掃描/語音輸入只保留靜態邊界、disabled placeholder 與來源欄位，不進入 MVP 正式流程。

## 體驗與導覽策略

- Web 登入後的預設首頁為 `calendar.html`，以個人行事曆為初始上下文。
- `index.html` 承接 Web 入口殼層、導向與未登入狀態；登入入口與管理入口集中在右上角全域操作區。
- 右上角全域操作區需同時承載登入/帳號、管理、球隊切換、身分切換，並明確標示當前所在球隊與身分。
- 使用者若同時屬於多支球隊，預設先看個人資料與個人成績，再主動切換到某支球隊查看球隊行事曆、成績、名單與管理功能。
- 即使使用者是教練、管理者或其他非球員角色，也必須先選擇球隊，才能查看該球隊的成績、資料與管理頁。
- 球隊切換與身分切換屬於 shared context，首頁、統計、報表、球員名單與管理入口都必須同步反映，不得混用前一個球隊的資料。

## 憲章檢查

*Gate：Phase 0 與 Phase 1 檢查結果*

- [x] 已同時規劃 Web UI 與 APP 介面展示，且皆依功能模組拆分。
- [x] Web 端以多個 HTML 頁面呈現，APP 端以可獨立展示的畫面流或模組頁呈現。
- [x] 所有互動僅以 HTML、CSS、JavaScript 與前端 mock 機制實作。
- [x] 每個模組都定義了可展示的測試資料、空狀態與錯誤狀態，且可對應 Web 與 APP 畫面。
- [x] 未引入任何實際 API、資料庫或第三方後端依賴。
- [x] 以本機靜態 server 啟動為正式展示方式，已明確排除 `file://` 執行。
- [x] `chat-history.md` 持續保留需求與任務追蹤紀錄。

**Gate Result**：通過。所有設計決策均維持在靜態前端雛型範圍內，且已明確定義 prototype 的執行前提。  
**Phase 1 Re-check**：`research.md`、`data-model.md`、`quickstart.md` 與 `contracts/` 產物已確認維持多頁 Web + APP 展示、前端 mock 資料、繁體中文文件、無後端整合，以及「本機靜態 server 啟動」的限制。

## 專案結構

### 文件產物

```text
specs/001-baseball-record-platform/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── web-ui-contract.md
    └── app-ui-contract.md
```

### 程式與展示資產

```text
pages/
├── index.html
├── auth.html
├── teams.html
├── players.html
├── games.html
├── calendar.html
├── lineup.html
├── review.html
├── stats.html
├── reports.html
└── share.html

app/
├── login.html
├── home.html
├── schedule.html
├── game-center.html
├── lineup.html
├── event-entry.html
├── substitutions.html
├── scoreboard.html
└── share-preview.html

assets/
├── css/
│   ├── tokens.css
│   ├── web.css
│   └── app.css
├── js/
│   ├── core/
│   │   ├── router.js
│   │   ├── data-loader.js
│   │   ├── mock-store.js
│   │   ├── permission-engine.js
│   │   ├── rule-engine.js
│   │   └── stats-engine.js
│   ├── web/
│   │   ├── common.js
│   │   ├── auth.js
│   │   ├── teams.js
│   │   ├── players.js
│   │   ├── games.js
│   │   ├── calendar.js
│   │   ├── lineup.js
│   │   ├── review.js
│   │   ├── stats.js
│   │   ├── reports.js
│   │   └── share.js
│   └── app/
│       ├── common.js
│       ├── login.js
│       ├── schedule.js
│       ├── game-center.js
│       ├── lineup.js
│       ├── event-entry.js
│       ├── substitutions.js
│       └── share-preview.js
└── data/
    ├── users.json
    ├── teams.json
    ├── players.json
    ├── games.json
    ├── calendar.json
    ├── attendance-responses.json
    ├── notifications.json
    ├── events.json
    └── share-tiers.json
```

### 頁面角色

- `pages/index.html`：Web 入口殼層與未登入狀態，負責承接首頁進站與導向行為。
- `pages/calendar.html`：登入後的預設首頁，先呈現個人行事曆，再依球隊切換顯示球隊賽程。
- `pages/teams.html`：從右上角管理入口進入的球隊管理畫面，需以當前球隊為前提。
- `pages/stats.html`：在個人視角可查看個人成績；選定球隊後則切換為該球隊脈絡下的成績查詢。
- `pages/reports.html`：球隊報表頁，需在當前球隊已選定後才進入有效內容。
- `app/home.html`、`app/schedule.html`：承接個人賽程、通知與快速回覆，補足 Web 首頁的個人日常情境。

## 結構決策

分享層級判斷、賽程回覆統計、比賽分類、特殊結果裁定、戰績納入與記錄來源識別集中在 `assets/js/core/`，球隊切換、身分切換與個人/球隊上下文也應由 shared context 管理，避免 Web 與 APP 對目前所在球隊或可見資料範圍產生分岔。採用本機靜態 server 啟動，可保留 ES Modules 與模組化設計，較適合接續後續正式開發。

## 複雜度追蹤

目前無需額外例外處理。若後續新增離線封裝、單檔匯出或 PWA 能力，再另外建立複雜度例外紀錄。
