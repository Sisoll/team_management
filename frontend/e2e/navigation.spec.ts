import { test, expect } from '@playwright/test'

test('app shell: tabs, placeholders, breadcrumb (UI shell)', async ({ page }) => {
  const email = `nav_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Nav')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()

  // 頂欄品牌 + 落地頁
  await expect(page.getByRole('button', { name: '⚾ 紀錄台' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的球隊' })).toBeVisible()

  // 建隊並進入 → 預設球員分頁 + 身分 chip
  await page.getByPlaceholder('球隊名稱').fill('Dragons')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByText('Dragons').click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)
  await expect(page.getByText(/你的身分/)).toBeVisible()

  // 佔位分頁顯示「即將推出」且 disabled
  await expect(page.locator('.tab-soon', { hasText: '統計' })).toHaveAttribute('aria-disabled', 'true')

  // 麵包屑可返回我的球隊
  await page.getByRole('link', { name: '我的球隊' }).click()
  await expect(page.getByRole('heading', { name: '我的球隊' })).toBeVisible()
})
