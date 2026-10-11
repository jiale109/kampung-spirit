import { test, expect } from '@playwright/test'
import { resetApp, login, logout } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('To redirect the root path to the landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/landing$/)
  await expect(page.getByRole('button', { name: 'Senior', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Youth', exact: true })).toBeVisible()
})

test('To log in as a senior and as a youth', async ({ page }) => {
  await login(page, 'Senior', 'Mdm Tan')
  await expect(page.getByTestId('username')).toHaveText('Mdm Tan Siew Lan')
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('username')).toHaveText('Wei Jie')
})

test('To block pages of the other role and when logged out', async ({ page }) => {
  await page.goto('/senior')
  await expect(page).toHaveURL(/\/landing$/)

  await login(page, 'Youth', 'Wei Jie')
  await page.goto('/senior')
  await expect(page).toHaveURL(/\/landing$/)
})
