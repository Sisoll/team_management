import { test, expect } from '@playwright/test'

test('create team, add/edit/archive player (AC-2/AC-3)', async ({ page }) => {
  const email = `tp_${Date.now()}@x.com`
  // 註冊登入
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Owner')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()

  // 建立球隊
  await expect(page.getByText('我的球隊')).toBeVisible()
  await page.getByPlaceholder('球隊名稱').fill('Tigers')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByText('Tigers').click()

  // 新增球員
  await page.getByPlaceholder('球員名稱').fill('Amy')
  await page.getByPlaceholder('背號').fill('7')
  await page.getByRole('button', { name: '新增球員' }).click()
  await expect(page.getByRole('cell', { name: 'Amy' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '7', exact: true })).toBeVisible()

  // 封存（軟刪）後預設清單看不到
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: '封存' }).click()
  await expect(page.getByRole('cell', { name: 'Amy' })).toHaveCount(0)
})
