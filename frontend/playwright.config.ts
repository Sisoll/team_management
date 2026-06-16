import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // 記錄/計分流程（SSE 推播＋sequence_no 重算）在多 worker 並行重載下是「慢但正確」，
  // 隔離跑約 17s；放寬單測逾時容納並行重載，斷言仍照常把關（真錯會 fail 而非逾時）。不用 retries 以免遮蓋間歇失敗。
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5200' },
  webServer: { command: 'npm run dev -- --port 5200', url: 'http://localhost:5200', reuseExistingServer: true },
})
