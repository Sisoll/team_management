import { test, expect } from '@playwright/test'

// 對齊 m3a-recording.spec.ts 的開賽前置。該 helper 未匯出，依計畫複製一份。
// away → 首半局我隊進攻；排 9 人合法名單並確認。

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
  await page.getByLabel('球隊名稱').fill('Box Team')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)

  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  for (const n of names) {
    await page.getByPlaceholder('球員名稱').fill(n)
    await page.getByRole('button', { name: '新增球員' }).click()
    await expect(page.getByRole('cell', { name: n, exact: true })).toBeVisible()
  }
  await page.getByRole('link', { name: '比賽' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await page.locator('input[type=date]').fill('2026-08-01')
  await page.locator('select').first().selectOption('baseball')
  await page.getByPlaceholder('對手名稱').fill('Foe')
  await page.getByLabel('主/客').selectOption('away')
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/.+\/lineup/)
  const pos = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  for (let i = 0; i < 9; i++) {
    await addStarter(page, names[i], pos[i], i + 1)
  }
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.locator('.ui-chip').filter({ hasText: '名單已確認' })).toBeVisible()
}

test('AC-10/12：記 HR → 計分板顯示比分 + 數據分頁顯示 box score', async ({ page }) => {
  await setupLiveGame(page, 'm3b')

  // 開賽（記錄分頁）
  await page.getByRole('link', { name: '記錄' }).click()
  await page.getByRole('button', { name: /開賽/ }).click()
  await expect(page.getByText(/我隊進攻/)).toBeVisible()

  // 記一支全壘打（壘上無人 → 直接送出），我隊 +1。
  // 等 statebar 反映得分後再切分頁（POST 為非同步，避免 race）。
  await page.getByRole('button', { name: 'HR', exact: true }).click()
  await expect(page.locator('.rec-statebar')).toContainText('0 : 1')

  // 計分板分頁：載入時 fetch /state（SSE 在背景），我隊應為 1 分（AC-10）。
  await page.getByRole('link', { name: '計分板' }).click()
  await expect(page.locator('.sb-team', { hasText: '我隊' }).locator('strong')).toHaveText('1')

  // 數據分頁：box score 打擊／投球表出現，HR 計為安打（AC-12）。
  await page.getByRole('link', { name: '數據' }).click()
  await expect(page.getByRole('heading', { name: '打擊（我隊）' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '投球（我隊）' })).toBeVisible()
  await expect(page.locator('.box-table').first().getByRole('cell', { name: '1', exact: true }).first()).toBeVisible()
})
