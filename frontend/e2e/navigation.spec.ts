import { test, expect } from '@playwright/test'

test('app shell v2: global tabs, create-team modal, sidebar, placeholders', async ({ page }) => {
  const email = `nav_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Nav')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()

  // 落在我的球隊（全域分頁殼）+ 頂欄品牌
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole('button', { name: '⚾ 紀錄台' })).toBeVisible()
  await expect(page.getByRole('link', { name: '我的球隊' })).toBeVisible()
  // 全域「總覽」佔位「尚未實作」且 disabled
  await expect(page.locator('.gtab-soon', { hasText: '總覽' })).toHaveAttribute('aria-disabled', 'true')
  // 尚無球隊空狀態
  await expect(page.getByText('尚無球隊')).toBeVisible()

  // 右上「建立球隊」→ Modal → 建立 → 進入球隊
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('Dragons')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)
  await expect(page.getByText(/你的身分/)).toBeVisible()
  // 側邊欄出現該隊
  await expect(page.locator('.ws-side').getByText('Dragons')).toBeVisible()
  // 球隊分頁佔位（統計）disabled
  await expect(page.locator('.tab-soon', { hasText: '統計' })).toHaveAttribute('aria-disabled', 'true')
})

async function register(page: any, name: string) {
  const email = `${name}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill(name)
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await expect(page).toHaveURL(/\/teams$/)
}

test('帳號選單：點選單外與 Esc 皆可關閉', async ({ page }) => {
  await register(page, 'Acct')
  const accountBtn = page.getByRole('button', { name: /Acct/ })
  const logout = page.getByRole('menuitem', { name: '登出' })

  // 點選單外關閉
  await accountBtn.click()
  await expect(logout).toBeVisible()
  await page.getByText('尚無球隊').click()
  await expect(logout).toBeHidden()

  // Esc 關閉
  await accountBtn.click()
  await expect(logout).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(logout).toBeHidden()
})

test('建立比賽頁：麵包屑與取消皆回比賽列表', async ({ page }) => {
  await register(page, 'Crumb')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('Crumb FC')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)

  await page.getByRole('link', { name: '比賽' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/games$/)

  // 取消鈕返回
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/new$/)
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/games$/)

  // 麵包屑「比賽」返回
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/new$/)
  await page.locator('.crumbs').getByRole('link', { name: '比賽' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/games$/)
})
