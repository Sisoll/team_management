import { test, expect } from '@playwright/test'

// 沿用 M1 e2e 慣例（team-player.spec.ts）：webServer 自動起前端；後端 5199 + Postgres 需先起。
async function registerAndTeam(page: any, prefix: string) {
  const email = `${prefix}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Owner')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await expect(page.getByText('我的球隊')).toBeVisible()
  await page.getByPlaceholder('球隊名稱').fill('M2 Team')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByText('M2 Team').click()
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

  // 建比賽（baseball / formal / 9 人，預設可直接送）
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page.locator('input[type=date]')).toBeVisible()
  await page.locator('input[type=date]').fill('2026-07-01')
  await page.getByPlaceholder('對手名稱').fill('Lions')
  await page.getByRole('button', { name: '建立比賽' }).click()

  // 名單編輯：等 GamePage 初始載入（game/players/roster GET）完成，避免初始 setSlots([]) 清掉手動新增的列
  await expect(page.getByRole('button', { name: '＋ 新增一列' })).toBeVisible()
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  // 逐列：新增 → 確認列已增 → 球員先、守位後（與 AC-6 相同、已驗證穩定）
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: '＋ 新增一列' }).click()
    await expect(page.locator('table.table tbody tr')).toHaveCount(i + 1)
    const row = page.locator('table.table tbody tr').nth(i)
    await row.locator('select').first().selectOption({ label: names[i] })
    await row.locator('select').nth(1).selectOption(positions[i])
  }

  await page.getByRole('button', { name: '確認名單' }).click()
  // status-chip 轉為「名單已確認」＝ gameStatus → lineup_confirmed（AC-5）
  await expect(page.locator('span.status-chip')).toHaveText('名單已確認')
})

test('AC-6：不合法名單顯示原因', async ({ page }) => {
  await registerAndTeam(page, 'm2b')

  await page.getByPlaceholder('球員名稱').fill('Solo')
  await page.getByRole('button', { name: '新增球員' }).click()
  await expect(page.getByRole('cell', { name: 'Solo', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page.locator('input[type=date]')).toBeVisible()
  await page.locator('input[type=date]').fill('2026-07-02')
  await page.getByPlaceholder('對手名稱').fill('Bears')
  await page.getByRole('button', { name: '建立比賽' }).click()

  // 只放 1 人、非投手守位 → 確認失敗顯示原因
  await expect(page.getByRole('button', { name: '＋ 新增一列' })).toBeVisible()
  await page.getByRole('button', { name: '＋ 新增一列' }).click()
  const row = page.locator('table.table tbody tr').first()
  await row.locator('select').first().selectOption({ label: 'Solo' })
  await row.locator('select').nth(1).selectOption('C')
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.getByText('名單不合法')).toBeVisible()
})
