# 開發工作流：SDD × superpowers — 棒壘球紀錄平台

> 本檔是本專案的**開發操作手冊**，套用到每一條垂直切片（MVP 與後續所有 Phase）。
> 設計細節見各切片的 design doc（如 `docs/superpowers/specs/2026-06-03-baseball-record-mvp-design.md`）。

## 定案的開發方式

- **SDD（規格驅動）+ superpowers** 為骨幹；既有 `specs/001-baseball-record-platform/spec.md` 為**產品事實來源**。
- 使用者**只在 AC（驗收標準）層級確認結果**，不逐行 review code（熟 Java，可選擇性抽查）。
- 技術棧：**Java Spring Boot + PostgreSQL + React/TypeScript**（API-first）；未來 RN-Expo 原生 app 重用同一 API。

## 兩層迴圈

```
每條切片 MACRO LOOP（MVP → Phase 2 → Phase 3 …）
① brainstorm→design → ② writing-plans → ③ TDD 實作 → ④ QA/E2E → ⑤ code review → ⑥ 確認 AC → ⑦ 收尾合併 → 下一條
                          gate② 輕量      worktree 隔離                              gate③ 主關卡

③ 內每個 task 的 MICRO LOOP：寫 AC 測試(紅) → 實作(綠) → 重構   ← superpowers TDD
```

## 各階段 → skill / 產物 / 人工角色

| 階段 | skill / 工具 | 產物 | 人工 |
|---|---|---|---|
| ① 設計 | `brainstorming` | design doc | **gate① 批准設計** |
| ② 計畫 | `writing-plans` | 實作計畫＝一串 task，**每 task 綁一條 AC** | gate② 輕量看任務拆分（可選） |
| ③ 實作 | **`subagent-driven-development`**（定案）＋ `test-driven-development` | 程式＋通過測試 | 不介入 |
| ④ QA/E2E | 見下方三層 | E2E 測試套件 | 不介入 |
| ⑤ 審查 | `requesting-code-review` / `/code-review` | review 並修正 | 不介入 |
| ⑥ 完工驗證 | `verification-before-completion` ＋ `verify` | 證據：測試綠燈＋app 實跑 | **gate③ 確認 AC** |
| ⑦ 收尾 | `finishing-a-development-branch` | merge / PR | 決定合併 |
| ⑧ 下一條 | 回 ① 或直接 ② | 下一切片 | — |

## QA / E2E 三層（定案：含 API E2E + Web E2E）

- **L1 單元**：`rule-engine` / `stats-engine` / 事件摺疊等純函式 → 逐條對應規格 RM / VR。
- **L2 整合**：Spring Boot Test + Testcontainers 真 Postgres → **每條對應一條 AC 的 Given/When/Then**。（本機只有 Podman：Testcontainers 走 **Podman socket**，必要時 `DOCKER_HOST` 指向 podman、ryuk 視情況調整。）
- **L3 端到端**：
  - **`api-e2e-test` skill** → `*CrudApiIT.java` + scenario JSON + DB 層級驗證（打 Spring API）。
  - **Playwright**（repo 已有 `.playwright-cli/`）→ Web 流程：記一場球一條龍、即時計分板。
  - **`verify` skill** → `podman compose` 起真 app，用眼睛確認即時計分板等行為。

## 隔離與 git

- 每條切片在**自己的 branch / git worktree**（`using-git-worktrees`）實作，完成走 `finishing-a-development-branch`。
- **不主動 commit / push**（依使用者全域規則）；commit 與否由使用者決定。

## 本機環境

- **容器執行時＝Podman（無 Docker）**：compose 用 `podman compose`（compose 檔相容）；Testcontainers 走 Podman socket（Windows 下啟用 podman machine socket）。

## 人工關卡（只有三個）

1. **gate① 設計**：批准 design doc。
2. **gate② 任務拆分**：輕量瞄一下 writing-plans 的 task 清單（可跳過）。
3. **gate③ 切片完工**：**AC 測試全綠 + app 走一遍**＝完成。

中途若有破壞性操作或二選一決策，agent 以 `【待決】` 暫停等使用者。
```
