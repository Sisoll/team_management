# frontend/CLAUDE.md — React + TypeScript Web

> Claude Code 在 `frontend/` 工作時自動載入。UI/資訊架構參考 `../legacy/prototype/{pages,app}`（唯讀參考，不沿用其 vanilla JS）。

## 技術與原則

- **React + TypeScript + Vite**；**響應式（RWD）**，桌機與手機同一套。
- 透過 **OpenAPI** 產 API client 串接 backend；**即時計分板訂閱 SSE**（`/api/games/{id}/stream`）。
- 介面語言 **繁體中文（zh-Hant）**。

## 視覺規範（沿用舊原型）

- **一律使用 design tokens，禁止寫死顏色/字體。**
- design tokens 來源 = `legacy/prototype/assets/css/tokens.css`，**scaffold 時複製進 frontend 作為唯一色票/字體來源**。
- 既有色系（暖米 + 球場綠）：
  - 底/面：`--bg #f4f1e7` · `--surface #fffdf7` · `--surface-alt #efe7d4` · `--border #cbbfa6`
  - 文字：`--text #231c13` · `--muted #6d6357`
  - 主色：`--accent #0e6b50` · `--accent-strong #084a37` · `--accent-soft #d7efe4`
  - 狀態：`--warning #b86a00` · `--danger #b82d2d` · `--info #245f8a`（各含 `-soft`）
  - 圓角：`--radius-lg/md/sm = 24/16/10px`
- **字體沿用舊原型**：`--font-sans: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`。

## 慣例

- component 小而專一，依功能分目錄；狀態管理方式於 scaffold 時定（先以最小可行為主）。
- 無障礙與鍵盤操作；表單錯誤訊息清楚。

<!-- 團隊補充約束（自行配色覆寫、component library、版面規範…）寫在這下面 -->
