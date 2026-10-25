import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard, uniqueTitle, postRequest } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

// Find one voucher card in the shop by merchant name
function voucherCard(page, merchant) {
  return page.locator('.voucher-card', { hasText: merchant })
}

test('A new account starts with 0 points and cannot redeem vouchers', async ({ page }) => {
  await login(page, 'Youth', 'Aisha')
  await expect(page.getByTestId('points')).toHaveText('⭐ 0 pts')
  await page.getByRole('link', { name: 'Rewards' }).click()
  await expect(page).toHaveURL(/\/app\/rewards$/)
  await expect(page.getByTestId('rewards-balance')).toContainText('0 pts')

  // Vouchers indicate that points are needed
  const kopitiam = voucherCard(page, 'Kimly Kopitiam')
  await expect(kopitiam).toBeVisible()
  await expect(kopitiam.getByText('Need pts')).toBeVisible()
  
  // Opening the voucher modal shows the redeem button disabled with needed points
  await kopitiam.click()
  const redeemBtn = page.getByRole('button', { name: 'Need 30 more pts' })
  await expect(redeemBtn).toBeVisible()
  await expect(redeemBtn).toBeDisabled()
  await page.locator('.modal-footer').getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.modal')).toHaveCount(0)
  await page.getByRole('button', { name: /My Wallet/i }).click()
  await expect(page.getByText('Your wallet is empty')).toBeVisible()
})