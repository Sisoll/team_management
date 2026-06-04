import { test, expect } from '@playwright/test'

test('register then see greeting (AC-1)', async ({ page }) => {
  const email = `e2e_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('E2E User')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await expect(page.getByText('嗨，E2E User')).toBeVisible()
})
