import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5200' },
  webServer: { command: 'npm run dev -- --port 5200', url: 'http://localhost:5200', reuseExistingServer: true },
})
