# 快速驗證指南

## 目的

本文件用於啟動並驗證棒壘球紀錄平台 prototype。此 prototype 為多頁靜態前端展示，需透過本機靜態 server 啟動；不支援直接雙擊 HTML 以 `file://` 開啟。

## 啟動方式

### 方式 1：Python 內建靜態 server

```bash
cd d:/projects/baseball_record
python -m http.server 4173
```

啟動後使用瀏覽器開啟：

- `http://localhost:4173/pages/index.html`
- `http://localhost:4173/app/home.html`

### 方式 2：Node 靜態 server

```bash
cd d:/projects/baseball_record
npx serve . -l 4173
```

同樣使用瀏覽器開啟：

- `http://localhost:4173/pages/index.html`
- `http://localhost:4173/app/home.html`

## 情境切換

所有頁面共用情境切換器，可切換以下展示資料：

- `baseline`
- `new-user`
- `restricted`
- `scorer-request`

切換後 Web / APP 會讀取同一份 shared state。

## 驗證路徑

### 路徑 1：身分與球隊治理

1. 開啟 Web `auth` 與 `teams` 頁面。
2. 切換不同情境與角色。
3. 確認可看到多球隊、多角色、邀請中、權限差異。
4. 驗證建立球隊、成員邀請與角色更新互動。

### 路徑 2：球員與名單

1. 開啟 Web `players` 與 `lineup` 頁面。
2. 檢查未綁定帳號、補綁、離隊回隊、不可出賽等狀態。
3. 驗證規則切換後的名單合法性提示。
4. 檢查 APP `lineup` 頁面是否同步顯示主要摘要。

### 路徑 3：賽程與通知

1. 開啟 Web `calendar` 頁面與 APP `home`、`schedule` 頁面。
2. 驗證參加 / 不參加 / 待定 / 未回覆狀態。
3. 驗證通知已讀與個人回覆變更後，摘要會同步更新。
4. 確認外部通道僅顯示 disabled placeholder，不進入真實流程。

### 路徑 4：即時記錄

1. 開啟 APP `game-center`、`event-entry`、`scoreboard`、`substitutions`。
2. 驗證手動、掃描、語音 `captureSource` 狀態。
3. 驗證掃描 / 語音事件先進入 `pending`，確認後才寫入正式時間線。
4. 驗證換人、代打、代跑、再上場提示與合法性結果。
5. 驗證臨時紀錄權限僅有待審核 / 已核准 / 已拒絕三種狀態，不做自動逾時。

### 路徑 5：賽後回顧與分享

1. 開啟 Web `review`、`stats`、`reports`、`share`。
2. 驗證事件修正後，統計與摘要會重新計算。
3. 驗證 A / B / C 分享層級切換與未授權封鎖提示。
4. 驗證報表預設為分類分開顯示，且特殊結果預設不納入戰績。
5. 檢查 APP `share-preview` 是否與 Web 分享邏輯一致。

## Smoke Checklist

- Web 與 APP 入口頁可正常載入。
- 情境切換與重設狀態可正常運作。
- 共用 core 邏輯可支援 Web / APP 同步展示。
- 即時記錄可顯示 `captureSource` 與 `pending` / `confirmed` 狀態。
- 分享頁可顯示 A / B / C 層級與封鎖狀態。
- 報表頁可顯示預設分類分開視圖與特殊結果排除邏輯。

## 完成標準

- 至少完成 3 條主要驗證路徑。
- Web 與 APP 各自至少完成 1 次情境切換驗證。
- 所有主要頁面皆可由本機靜態 server 載入。
- 關鍵互動不出現阻斷操作的 JavaScript 錯誤。
- 一般切換與主要互動的體感更新時間維持在約 200ms 內。
