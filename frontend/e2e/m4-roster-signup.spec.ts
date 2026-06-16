import { test, expect } from '@playwright/test'

// webServer 自動起前端；後端 5199 + Postgres 需先起。
// 沿用 m2-games-lineup.spec.ts 的 register→建隊→建球員→建賽→進 LineupTab 流程。
// 拖拉在 E2E 不穩，一律用卡片上的按鈕（→先發/→替補/↩退回/移除）與 select 操作。

async function registerAndTeam(page: any, prefix: string) {
  const email = `${prefix}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Owner')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('M4 Team')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)
}

async function addPlayers(page: any, names: string[]) {
  for (const n of names) {
    await page.getByPlaceholder('球員名稱').fill(n)
    await page.getByRole('button', { name: '新增球員' }).click()
    await expect(page.getByRole('cell', { name: n, exact: true })).toBeVisible()
  }
}

async function gotoLineup(page: any, date: string, opponent: string) {
  await page.getByRole('link', { name: '比賽' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page.locator('input[type=date]')).toBeVisible()
  await page.locator('input[type=date]').fill(date)
  await page.getByPlaceholder('對手名稱').fill(opponent)
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/.+\/lineup/)
  // 看板已載入
  await expect(page.getByRole('button', { name: '＋ 直接加入先發' })).toBeVisible()
}

// 在「先發」欄用「＋ 直接加入先發」加一張卡並選球員＋守位
async function addStarter(page: any, name: string, pos: string, expectCount: number) {
  await page.getByRole('button', { name: '＋ 直接加入先發' }).click()
  const col = page.locator('.roster-col[data-col="starter"]')
  await expect(col.locator('.roster-card')).toHaveCount(expectCount)
  const card = col.locator('.roster-card').nth(expectCount - 1)
  await card.getByLabel('球員').selectOption({ label: name })
  await card.getByLabel('守位').selectOption(pos)
}

test('AC-A/B/D/E：報名清單不驗證、放進先發驗證人數不足、補滿後確認', async ({ page }) => {
  await registerAndTeam(page, 'm4a')
  const names = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']
  await addPlayers(page, names)
  await gotoLineup(page, '2026-07-10', 'Lions')

  // AC-A：在「報名清單」加一名球員、設狀態（遲到），儲存草稿 → 出現「已儲存」、不觸發驗證錯誤。
  await page.getByRole('button', { name: '＋ 報名 / 加候補' }).click()
  const signupCol = page.locator('.roster-col[data-col="signup"]')
  await expect(signupCol.locator('.roster-card')).toHaveCount(1)
  const signupCard = signupCol.locator('.roster-card').first()
  await signupCard.getByLabel('球員').selectOption({ label: names[0] })
  await signupCard.getByLabel('狀態').selectOption('late')
  await page.getByRole('button', { name: '儲存草稿' }).click()
  await expect(page.getByText('已儲存')).toBeVisible()
  // 儲存不應觸發「名單不合法」
  await expect(page.getByText('名單不合法')).toHaveCount(0)

  // AC-B/D：把報名者「→先發」、設守位，驗證名單 → 只有 1 人應「名單不合法」，但儲存未被擋。
  await signupCol.getByRole('button', { name: '→先發' }).click()
  await expect(signupCol.locator('.roster-card')).toHaveCount(0)
  const starterCol = page.locator('.roster-col[data-col="starter"]')
  await expect(starterCol.locator('.roster-card')).toHaveCount(1)
  await starterCol.locator('.roster-card').first().getByLabel('守位').selectOption('P')
  await page.getByRole('button', { name: '驗證名單' }).click()
  await expect(page.getByText('名單不合法')).toBeVisible()

  // AC-E：補滿到 9 名合法先發 → 確認名單 → 名單已確認。
  // 已有 1 名先發（names[0]）；再補 names[1..8] 共 8 名，守位避開重複。
  const pos = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  for (let i = 1; i < 9; i++) {
    await addStarter(page, names[i], pos[i], i + 1)
  }
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.locator('.ui-chip').filter({ hasText: '名單已確認' })).toBeVisible()
})

test('AC-C：替補進出與退回報名（三欄卡片數量變化）', async ({ page }) => {
  await registerAndTeam(page, 'm4c')
  await addPlayers(page, ['G0'])
  await gotoLineup(page, '2026-07-11', 'Bears')

  const signupCol = page.locator('.roster-col[data-col="signup"]')
  const starterCol = page.locator('.roster-col[data-col="starter"]')
  const benchCol = page.locator('.roster-col[data-col="bench"]')

  // 「＋ 直接加入替補」→ bench 多一張卡
  await page.getByRole('button', { name: '＋ 直接加入替補' }).click()
  await expect(benchCol.locator('.roster-card')).toHaveCount(1)
  // 選一名球員（避免空白卡在後續儲存被擋；本測只驗看板移動，仍選球員較穩）
  await benchCol.locator('.roster-card').first().getByLabel('球員').selectOption({ label: 'G0' })

  // bench「→先發」→ starter 多一張、bench 歸零
  await benchCol.getByRole('button', { name: '→先發' }).click()
  await expect(starterCol.locator('.roster-card')).toHaveCount(1)
  await expect(benchCol.locator('.roster-card')).toHaveCount(0)

  // starter「↩退回報名」→ signup 多一張、starter 歸零
  await starterCol.getByRole('button', { name: '↩退回報名' }).click()
  await expect(signupCol.locator('.roster-card')).toHaveCount(1)
  await expect(starterCol.locator('.roster-card')).toHaveCount(0)
})

test('空白卡不擋存檔、reload 後已排球員不重複出現在報名池（round-trip）', async ({ page }) => {
  await registerAndTeam(page, 'm4rt')
  await addPlayers(page, ['R0'])
  await gotoLineup(page, '2026-07-12', 'Hawks')

  // 先把 R0 排進先發
  await addStarter(page, 'R0', 'P', 1)
  // 再加一張「沒填」的空白報名卡（既不選球員也不填路人）
  await page.getByRole('button', { name: '＋ 報名 / 加候補' }).click()
  await expect(page.locator('.roster-col[data-col="signup"] .roster-card')).toHaveCount(1)

  // 儲存草稿：空白卡應被前端過濾、不該整批失敗 → 出現「已儲存」
  await page.getByRole('button', { name: '儲存草稿' }).click()
  await expect(page.getByText('已儲存')).toBeVisible()

  // reload：R0 仍在先發；報名池不應出現 R0（已排者寫成 present，load 時排除），空白卡也已消失
  await page.reload()
  await expect(page.getByRole('button', { name: '＋ 直接加入先發' })).toBeVisible()
  const starterCol = page.locator('.roster-col[data-col="starter"]')
  const signupCol = page.locator('.roster-col[data-col="signup"]')
  await expect(starterCol.locator('.roster-card')).toHaveCount(1)
  await expect(starterCol.locator('.roster-card').first()).toContainText('R0')
  await expect(signupCol.locator('.roster-card')).toHaveCount(0)
})
