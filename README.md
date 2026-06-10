# 棒壘球紀錄平台（Baseball/Softball Record Platform）

把既有純前端 mock 雛型**全端重做**成真實系統：帳號 / 球隊 / 球員 → 建比賽 → 出賽名單 → 賽中即時記錄 → 單場統計。API-first，未來可重用同一套 API 上 iOS / Android。

- **產品事實來源**：[`specs/001-baseball-record-platform/spec.md`](specs/001-baseball-record-platform/spec.md)（17 實體 / ~80 FR）
- **總綱設計**：[`docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md`](docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md)
- **開發工作流**：[`docs/superpowers/WORKFLOW.md`](docs/superpowers/WORKFLOW.md)

## 技術棧

| 層 | 技術 |
|---|---|
| 後端 | Java **21** + Spring Boot **3.5**（Web / Data-JPA / Security / Validation）、PostgreSQL **16** + Flyway、JWT + 域內 RBAC |
| 前端 | React 18 + TypeScript + Vite 5（響應式 Web，繁體中文 UI） |
| 測試 | JUnit 5 + Testcontainers（真 Postgres）、Playwright（E2E） |
| 容器 | **Podman**（本機無 Docker） |

## Repo 結構

```
backend/    Spring Boot API（見 backend/CLAUDE.md）
frontend/   React + TypeScript（見 frontend/CLAUDE.md）
specs/      產品規格（事實來源）
docs/superpowers/  設計文件、實作計畫、工作流
legacy/     舊 mock 雛型（★唯讀 UI 參考，不進新 codebase）
```

## 先決條件

- **JDK 21**（本專案限定；下方 Windows 註記說明如何就地切換而不動系統預設）
- **Node.js 20+** 與 **npm**
- **Maven 3.9+**（用系統 `mvn`）
- **Podman**（含 `podman compose` 或 `podman-compose`）— 起 PostgreSQL 與跑整合測試

## 快速啟動（Quickstart）

需要三個程序：**DB（5432）→ 後端（5199）→ 前端（5200）**。開三個終端機。

### 1. 啟動資料庫（PostgreSQL via Podman）

```bash
podman compose -f backend/compose.yaml up -d
# 若用 pip 版：podman-compose -f backend/compose.yaml up -d
```
建立 `baseball` 資料庫（帳密 `baseball` / `baseball`，連接埠 5432）。

### 2. 啟動後端（port 5199）

```bash
cd backend
# 確保使用 JDK 21（見下方 Windows 註記）
mvn spring-boot:run
```
啟動時 **Flyway 自動建表並 seed 規則集**（V1 users → V2 teams/players → V3 games/roster/rules）。
健康檢查：`curl http://localhost:5199/api/health` → `200`。

### 3. 啟動前端（port 5200）

```bash
cd frontend
npm install      # 首次
npm run dev      # Vite，已設定 /api → localhost:5199 proxy
```
瀏覽器開 **http://localhost:5200** → 註冊帳號 → 建球隊 → 加球員 → 建比賽 → 編名單 → 確認。

### 測試帳號（dev）

本機開發 / 驗收可直接用這組已預先註冊的測試帳號登入：

| 欄位 | 值 |
|---|---|
| Email | `demo@baseball.test` |
| 密碼 | `demo1234` |

> 註冊為開放式：若資料庫是全新或被清空，這組帳號可能尚不存在——在登入頁用同一組 Email / 密碼按「註冊」即可重建（或自行註冊任意帳號）。**僅供本機 / 測試，請勿用於正式環境。**

## 環境變數

| 變數 | 預設 | 說明 |
|---|---|---|
| `JWT_SECRET` | 內建 dev 值 | 後端 JWT 簽章金鑰（正式環境請覆寫，≥32 bytes）|
| DB 連線 | `jdbc:postgresql://localhost:5432/baseball`（`baseball`/`baseball`）| 見 `backend/src/main/resources/application.yaml` |

## 連接埠

| 服務 | Port |
|---|---|
| PostgreSQL | 5432 |
| 後端 API | 5199 |
| 前端（Vite） | 5200（`/api` proxy 至 5199）|

## 測試

```bash
# 後端：單元 + 整合（整合測試用 Testcontainers 自動起臨時 Postgres）
cd backend && mvn test

# 前端 E2E（需先啟動「DB + 後端」，Playwright 會自動起前端 dev server）
cd frontend && npx playwright test
```

> **Testcontainers + Podman**：整合測試需 Podman socket 可達（Windows 走 npipe；必要時設定 `~/.testcontainers.properties` 或 `DOCKER_HOST` 指向 podman socket）。

## Windows 開發註記（JDK 21 就地切換）

本專案需 Java 21，但若系統預設是其他版本，**不要改整機環境變數**——在 build/test 的 shell 開頭就地 export（只影響該 shell）：

```bash
export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
mvn -version   # 應顯示 Java version: 21
```

收尾若 Vite 殘留 node 程序咬住快取：`taskkill //F //IM node.exe` 後刪 `frontend/node_modules/.vite`。

## 進度（里程碑）

| 里程碑 | 範圍 | AC | 狀態 |
|---|---|---|---|
| M1 | 帳號 / 球隊 / 球員 / RBAC | AC-1,2,3 | ✅ 已完成（`master`）|
| M2 | 比賽 / 規則集 / 出賽名單 / 名單驗證 | AC-4,5,6,7 | ✅ 已完成（`feat/m2-games-lineup`）|
| M3 | 賽中事件溯源 / SSE 即時計分板 / 單場統計 | AC-8–12 | ⏳ 未開始 |

各里程碑設計/計畫見 `docs/superpowers/specs/` 與 `docs/superpowers/plans/`。
