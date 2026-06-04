# backend/CLAUDE.md — Spring Boot API

> Claude Code 在 `backend/` 工作時自動載入。產品需求見 `../specs/`，設計見 `../docs/superpowers/specs/`。

## 本機建置（JDK 21 就地切換）⚠️

- 本專案限定 **Java 21 + Spring Boot 3.5**；**系統全域 JAVA_HOME 維持 17 不動**（其他專案用 17）。
- JDK 21 已裝在 `C:\Program Files\OpenJDK\jdk-21`（Oracle JDK 21）。
- **每個 build / test shell 開頭就地 export**（只影響該 shell，不污染系統）：

  ```bash
  export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"
  export PATH="$JAVA_HOME/bin:$PATH"
  ```
- 驗證：`mvn -version` 應顯示 `Java version: 21 ... runtime: C:\Program Files\OpenJDK\jdk-21`。
- 別用 `setx /M` 或改 Machine 環境變數把整機切 21；安裝程式曾誤改過，已還原成 17。

## 技術與原則

- **Java Spring Boot**；**PostgreSQL**（JPA/Hibernate；事件 payload/快照用 **JSONB**）。
- **API-first**：REST + OpenAPI（spec 與實作同步）。回應一致的錯誤格式。
- **認證/授權**：Spring Security + JWT 自管 identity；**域內 RBAC**（球隊角色授權放 DB，不外包）。

## 套件結構（package-by-module）

```
auth · team · player · game · lineup · scoring · stats
shared/  ruleengine（規則驗證，純函式）
         authorization（角色 policy）
         eventfold（事件摺疊推導場上狀態）
```

## 事件溯源（賽中記錄核心）

- `GameEvent` **只增不改**；場上狀態由事件「摺疊」推導；每筆寫入算 `snapshotAfter`（JSONB）。
- 補登/修正某筆事件 → 從該點**重算後續快照與統計**（對應 VR-007）。

## 測試（TDD）

- 純函式引擎（ruleengine / stats / eventfold）→ 大量 **unit test**，逐條對應規格 RM/VR。
- API → **integration test**（Spring Boot Test + **Testcontainers** 真 Postgres），**每條對應一條 AC 的 Given/When/Then**。
- ⚠️ 本機只有 **Podman**：Testcontainers 走 Podman socket（必要時 `DOCKER_HOST` 指向 podman、ryuk 視情況調整）。

## 慣例

- DTO 與 entity 分離；輸入驗證集中；命名一致（英文）。
- 不在 controller 放業務邏輯；規則/授權走 shared 模組。

<!-- 團隊補充約束（package 命名、例外處理細則、log 規範…）寫在這下面 -->
