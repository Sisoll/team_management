import { test, expect } from '@playwright/test'

test('register then land on app shell (AC-1)', async ({ page }) => {
  const email = `e2e_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('E2E User')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  // 登入後落在「我的球隊」（全域分頁殼）；頂欄帳號 + 全域分頁可見
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole('button', { name: /E2E User/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '我的球隊' })).toBeVisible()
})
