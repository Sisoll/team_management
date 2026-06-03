# CLAUDE.md — 棒壘球紀錄平台（全端重做）

本檔是 repo 層級 agent 指引（在 user 全域 CLAUDE.md 之後讀取，可疊加專案規則）。

## 專案

把既有「純前端 mock 雛型」**全端重做成真實系統**。
- **產品事實來源**：[`specs/001-baseball-record-platform/spec.md`](specs/001-baseball-record-platform/spec.md)（既有完整規格，17 實體 / ~80 FR）。
- **目前進行的設計**：[`docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md`](docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md)（MVP＝記一場球）。
- **開發工作流**：[`docs/superpowers/WORKFLOW.md`](docs/superpowers/WORKFLOW.md)。

## 技術棧

- **backend/**：Java Spring Boot + PostgreSQL（API-first，REST + OpenAPI，JWT + 域內 RBAC）。
- **frontend/**：React + TypeScript（響應式 Web；即時計分板走 SSE）。
- 未來：iOS + Android（React Native / Expo，重用同一 API）+ 語音/拍照辨識。

## 開發方式（重要）

- **SDD × superpowers**：brainstorming→design → `writing-plans` → `subagent-driven-development` + TDD → QA → review → 確認 AC → 收尾。詳見 WORKFLOW.md。
- 使用者**只在 AC 層級確認結果**，不逐行 review code。
- **不主動 commit / push**（依使用者全域規則）；commit 與否由使用者決定。

## 本機環境

- **容器執行時只有 Podman（無 Docker）**：compose 用 `podman compose`；Testcontainers 走 Podman socket（Windows podman machine）。

## Repo 結構

```
backend/    Spring Boot（見 backend/CLAUDE.md）
frontend/   React + TS（見 frontend/CLAUDE.md）
specs/      產品規格（Spec Kit，產品事實來源）
docs/superpowers/  設計文件與工作流
legacy/     舊 mock 雛型（UI/資訊架構參考；★唯讀，不要改、不要進新 codebase）
```

→ 各層細部約束見 **`backend/CLAUDE.md`** 與 **`frontend/CLAUDE.md`**（Claude Code 在該目錄工作時會自動載入）。
