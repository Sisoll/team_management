# 本機開發（Podman，無 Docker）

## 啟動 Postgres
    cd backend && podman compose up -d db

## Testcontainers 透過 Podman socket
1. 啟動 podman machine 並確認 socket：
   podman machine start
2. 設定環境變數（Windows PowerShell 範例，請依實際 socket 路徑調整）：
   $env:DOCKER_HOST = "npipe:////./pipe/podman-machine-default"
   $env:TESTCONTAINERS_RYUK_DISABLED = "true"
   （或在 ~/.testcontainers.properties 設 docker.host 與 ryuk.disabled=true）
3. 驗證：cd backend && ./mvnw -q -Dtest=HealthControllerIT test 之後再跑整合測試。
