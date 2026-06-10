import { test, expect } from '@playwright/test'

// webServer 自動起前端；後端 5199 + Postgres 需先起。
async function registerAndTeam(page: any, prefix: string) {
  const email = `${prefix}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Owner')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  // 右上角 Modal 建立球隊 → 自動進該隊球員分頁
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('M2 Team')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)
}

async function gotoCreateGame(page: any) {
  // 從球員分頁切到「比賽」分頁，再建立比賽
  await page.getByRole('link', { name: '比賽' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page.locator('input[type=date]')).toBeVisible()
}

test('AC-4/5：建比賽 + 合法名單確認', async ({ page }) => {
  await registerAndTeam(page, 'm2a')

  // 加 9 名球員
  const names = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']
  for (const n of names) {
    await page.getByPlaceholder('球員名稱').fill(n)
    await page.getByRole('button', { name: '新增球員' }).click()
    await expect(page.getByRole('cell', { name: n, exact: true })).toBeVisible()
  }

  await gotoCreateGame(page)
  await page.locator('input[type=date]').fill('2026-07-01')
  await page.getByPlaceholder('對手名稱').fill('Lions')
  await page.getByRole('button', { name: '建立比賽' }).click()

  await expect(page).toHaveURL(/\/games\/.+\/lineup/)
  await expect(page.getByRole('button', { name: '＋ 新增一列' })).toBeVisible()
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: '＋ 新增一列' }).click()
    await expect(page.locator('table.table tbody tr')).toHaveCount(i + 1)
    const row = page.locator('table.table tbody tr').nth(i)
    await row.locator('select').first().selectOption({ label: names[i] })
    await row.locator('select').nth(1).selectOption(positions[i])
  }

  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.locator('.ui-chip').filter({ hasText: '名單已確認' })).toBeVisible()
})

test('AC-6：不合法名單顯示原因', async ({ page }) => {
  await registerAndTeam(page, 'm2b')

  await page.getByPlaceholder('球員名稱').fill('Solo')
  await page.getByRole('button', { name: '新增球員' }).click()
  await expect(page.getByRole('cell', { name: 'Solo', exact: true })).toBeVisible()

  await gotoCreateGame(page)
  await page.locator('input[type=date]').fill('2026-07-02')
  await page.getByPlaceholder('對手名稱').fill('Bears')
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/.+\/lineup/)

  await expect(page.getByRole('button', { name: '＋ 新增一列' })).toBeVisible()
  await page.getByRole('button', { name: '＋ 新增一列' }).click()
  const row = page.locator('table.table tbody tr').first()
  await row.locator('select').first().selectOption({ label: 'Solo' })
  await row.locator('select').nth(1).selectOption('C')
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.getByText('名單不合法')).toBeVisible()
})
