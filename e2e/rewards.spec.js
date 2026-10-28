import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard, uniqueTitle, postRequest } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

// Find one voucher card in the shop by merchant name
function voucherCard(page, merchant) {
  return page.locator('.voucher-card', { hasText: merchant })
}

test('new account starts with 0 points and cannot redeem vouchers', async ({ page }) => {
  await login(page, 'Youth', 'Aisha')
  await expect(page.getByTestId('points')).toContainText(' 0 pts')

  await page.getByRole('link', { name: 'Rewards' }).click()
  await voucherCard(page, 'Kimly Kopitiam').click()
  await expect(page.getByRole('button', { name: 'Need 30 more pts' })).toBeDisabled()
  await page.getByText('Close').click();

  await page.getByRole('button', { name: 'My Wallet' }).click();
  await expect(page.getByText('Your wallet is empty')).toBeVisible()
})

test('youth earns points from a confirmed task, redeems a voucher, and manages it in wallet', async ({ page }) => {
  const title = uniqueTitle('Teach me how to use PayLah')

  // senior post request 
  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title, difficulty: 'Hard', duration: '60 min' })
  await logout(page)

  // Youth accepts and marks done
  await login(page, 'Youth', 'Wei Jie')
  const task = await openCard(page, title)
  await task.getByTestId('accept').click()
  await page.getByTestId('confirm-accept').click() 

  await page.getByRole('link', { name: 'My Tasks', exact: true }).click() 
  const myTask = await openCard(page, title)
  await myTask.getByTestId('mark-done').click()

  await logout(page)

  // confirm completion
  await login(page, 'Senior', 'Mdm Tan')
  await card(page, title).getByTestId('confirm').click()
  await expect(page.getByText(/earned 60 points/)).toBeVisible()
  await logout(page)

  // youth logs in, get points
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('points')).toContainText('60 pts')
  await page.getByRole('link', { name: 'Rewards' }).click()

  // not enough points
  await voucherCard(page, 'FairPrice').click()
  await expect(page.getByRole('button', { name: 'Need 90 more pts' })).toBeDisabled()
  await page.getByText('Close').click()

  // enough points
  await voucherCard(page, '7-Eleven').click()
  await page.getByRole('button', { name: 'Redeem for 50 pts' }).click()
  await page.getByTestId('confirm-redeem').click()
  await expect(page.getByRole('status')).toContainText('Success! You redeemed')
  await expect(page.getByTestId('points')).toContainText('10 pts')
  const walletItem = page.locator('.card', { hasText: '7-Eleven' })
  await expect(walletItem.getByText('Ready to use')).toBeVisible()

  // mark voucher as used
  await walletItem.getByRole('button', { name: 'Mark as used' }).click()
  await expect(walletItem.getByText('Used', { exact: true })).toBeVisible()

  // points decrease 
  await page.getByRole('button', { name: 'Browse Vouchers' }).click()
  await voucherCard(page, 'Kimly Kopitiam').click()
  await expect(page.getByRole('button', { name: 'Need 20 more pts' })).toBeDisabled()
})