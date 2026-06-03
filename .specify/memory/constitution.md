<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - I. 模組化多頁雛型優先 -> I. 網頁與 APP 模組化介面優先
  - II. 前端靜態展示實作 -> II. 前端靜態介面展示實作
  - III. 展示資料必備 -> III. 展示資料必備
- Added sections:
  - None
- Removed sections:
  - None
- Templates requiring updates:
  - updated: .specify/templates/constitution-template.md
  - updated: .specify/templates/plan-template.md
  - updated: .specify/templates/spec-template.md
  - updated: .specify/templates/tasks-template.md
  - pending: .specify/templates/commands/*.md (directory not present)
- Follow-up TODOs:
  - None
-->
# baseball_record 專案憲章

## Core Principles

### I. 網頁與 APP 模組化介面優先
系統雛型 MUST 同時提供網頁 UI 展示與 APP 介面展示，且兩者都必須依功能模組拆分。
網頁端 MUST 以多個 HTML 頁面呈現，不得以單一頁面承載所有流程；APP 端 MUST 以可獨立展示的
畫面序列或模組頁呈現，可使用 HTML 模擬行動裝置介面。每個功能模組 MUST 可獨立導覽、獨立展示，
並在規劃文件中清楚標示該模組對應的網頁頁面與 APP 畫面。這項原則確保資訊架構、操作流程與跨裝置
體驗都能被明確檢視，而不是只展示單一平台的局部結果。

### II. 前端靜態介面展示實作
所有功能 MUST 以 HTML、CSS 與 JavaScript 實作或模擬，重點放在網頁 UI、APP 畫面、互動流程與
狀態切換。雛型 MAY 使用瀏覽器端假資料、local state、前端事件、裝置外框樣式與靜態資源達成展示，
但 MUST NOT 引入需要伺服器運算的實際後端流程。這項原則確保雛型可快速預覽、易於示範，並能以
一致的前端技術同時呈現桌面與行動裝置介面。

### III. 展示資料必備
每個功能模組 MUST 提供足以展示主要情境、異常情境與空資料情境的測試資料。
若同一功能同時有網頁 UI 與 APP 畫面，測試資料 MUST 能支援兩種介面的展示情境一致性。
測試資料 MUST 可由靜態檔案、內嵌常數或前端 mock 物件取得，且在展示時可直接操作。
沒有展示資料的頁面視為未完成，因為雛型的核心目的在於讓流程與資訊呈現可被驗證。

### IV. 禁止後端與外部介接實作
API 介接、資料庫存取、身分驗證串接、排程、訊息佇列與任何外部系統整合 MUST NOT 實作。
若畫面需要呈現這類結果，MUST 以 JavaScript mock 行為、假回應或靜態資料模擬。
規格、計畫與任務若出現後端開發、資料表設計或實際串接工作，必須在憲章檢查中標示為違規。

### V. 繁體中文規格與對話留存
所有規格相關 Markdown 文件 MUST 以台灣繁體中文撰寫，包括憲章、spec、plan、tasks、
checklist 與衍生說明。每次處理需求時，Context Window 中可見的原始對話歷程 MUST 完整保留
至 `chat-history.md`，作為需求追溯依據。這項原則確保文件語言一致、利害關係人易於審閱，
並保留需求演變的完整脈絡。

## 技術與範圍邊界

- 雛型交付物 MUST 以靜態前端資產為主，包含 HTML、CSS、JavaScript 與展示資料檔案。
- 網頁 UI 與 APP 介面展示 MUST 一併規劃；若兩者資訊架構不同，規格文件 MUST 明確註記差異原因。
- 若需模擬資料持久化，MUST 明確標示為前端暫存或假資料機制，不得描述為正式資料庫方案。
- 規格文件 MUST 清楚列出哪些流程僅為模擬展示，避免被誤解為已完成正式系統整合。
- 所有頁面、APP 畫面與模組命名 SHOULD 對應實際業務功能，以利後續從雛型轉為正式系統設計。

## 開發與審查流程

- 在 `/speckit.plan` 階段，憲章檢查 MUST 驗證是否同時規劃網頁 UI 與 APP 介面展示、
  是否為多頁 HTML 模組化架構、是否排除後端實作、是否定義展示資料策略，以及文件是否以
  台灣繁體中文撰寫。
- 在 `/speckit.specify` 與 `/speckit.tasks` 產出中，使用者故事、需求、任務與驗收情境 MUST
  以畫面操作與展示結果為核心，並明確區分網頁 UI 與 APP 畫面需求，不得生成 API、資料庫或
  基礎設施建置工作作為必要範圍。
- 每次新增或修訂規格前，MUST 先更新 `chat-history.md`，確保需求來源與決策脈絡可追蹤。
- 審查時 MUST 檢查每個模組是否具備可操作的網頁頁面、APP 畫面與測試資料；
  僅有文字描述而無展示介面者不得視為完成。

## Governance

本憲章高於其他規劃慣例；若任何 spec、plan、tasks 或衍生文件與本憲章衝突，
以本憲章為準。憲章修訂 MUST 同步檢查並更新 `.specify/templates/` 內的相關模板，
並在憲章頂部的 Sync Impact Report 記錄影響範圍。版本採語意化版本管理：
新增或實質擴充原則為 MINOR，刪除或重新定義既有治理規則為 MAJOR，
純文字澄清或非語意修改為 PATCH。所有規格審查 MUST 進行憲章符合性檢查；
若需暫時偏離，必須在計畫文件中明確記錄違規原因、替代方案與核准依據。

**Version**: 1.1.0 | **Ratified**: 2026-03-25 | **Last Amended**: 2026-03-25
