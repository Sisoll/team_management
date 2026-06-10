import { test, expect } from '@playwright/test'

test('register then see account in top bar (AC-1)', async ({ page }) => {
  const email = `e2e_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('E2E User')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  // 登入後落地「我的球隊」，頂欄帳號選單顯示名稱
  await expect(page.getByRole('heading', { name: '我的球隊' })).toBeVisible()
  await expect(page.getByRole('button', { name: /E2E User/ })).toBeVisible()
})
