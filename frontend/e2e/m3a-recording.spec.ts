import { test, expect } from '@playwright/test'

// 新看板：用欄尾「＋ 直接加入先發」加一張先發卡，選球員＋守位。
async function addStarter(page: any, name: string, pos: string, expectCount: number) {
  await page.getByRole('button', { name: '＋ 直接加入先發' }).click()
  const col = page.locator('.roster-col[data-col="starter"]')
  await expect(col.locator('.roster-card')).toHaveCount(expectCount)
  const card = col.locator('.roster-card').nth(expectCount - 1)
  await card.getByLabel('球員').selectOption({ label: name })
  await card.getByLabel('守位').selectOption(pos)
}

async function setupLiveGame(page: any, prefix: string) {
  const email = `${prefix}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Rec')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('Rec Team')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)

  // 9 名球員
  const names = ['A','B','C','D','E','F','G','H','I']
  for (const n of names) {
    await page.getByPlaceholder('球員名稱').fill(n)
    await page.getByRole('button', { name: '新增球員' }).click()
    await expect(page.getByRole('cell', { name: n, exact: true })).toBeVisible()
  }
  // 建賽（away→首半局我隊進攻）
  await page.getByRole('link', { name: '比賽' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await page.locator('input[type=date]').fill('2026-08-01')
  await page.locator('select').first().selectOption('baseball')
  await page.getByPlaceholder('對手名稱').fill('Foe')
  // 主/客 選客場（away），確保首半局我隊進攻→三振後翻成「我隊守備」
  await page.getByLabel('主/客').selectOption('away')
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/.+\/lineup/)
  // 排 9 人合法名單（新看板：直接加入先發）
  const pos = ['P','C','1B','2B','3B','SS','LF','CF','RF']
  for (let i = 0; i < 9; i++) {
    await addStarter(page, names[i], pos[i], i + 1)
  }
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.locator('.ui-chip').filter({ hasText: '名單已確認' })).toBeVisible()
}

test('AC-8/11：開賽、記錄、撤銷重算', async ({ page }) => {
  await setupLiveGame(page, 'm3a')
  // 進記錄分頁 → 開賽
  await page.getByRole('link', { name: '記錄' }).click()
  await page.getByRole('button', { name: /開賽/ }).click()

  // 記三次三振 → 換半局（我隊守備）。每筆事件經非同步 POST（算 sequence_no），須序列化等狀態更新。
  await expect(page.getByText(/我隊進攻/)).toBeVisible()
  await page.getByRole('button', { name: '三振' }).click()
  await expect(page.getByText(/1 出局/)).toBeVisible()
  await page.getByRole('button', { name: '三振' }).click()
  await expect(page.getByText(/2 出局/)).toBeVisible()
  await page.getByRole('button', { name: '三振' }).click()
  await expect(page.getByText(/我隊守備/)).toBeVisible()

  // 時間線有 3 筆，刪一筆後剩 2（AC-11 重算）
  await page.getByRole('link', { name: '時間線' }).click()
  await expect(page.locator('table.table tbody tr')).toHaveCount(3)
  await page.locator('table.table tbody tr').first().getByRole('button', { name: '刪除' }).click()
  await expect(page.locator('table.table tbody tr')).toHaveCount(2)
})
