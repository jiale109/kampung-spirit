import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('Senior can create, edit and cancel a request', async ({ page }) => {
  await login(page, 'Senior', 'Mdm Tan')
  await page.getByRole('link', { name: '+ Ask for Help' }).first().click()

  // Validation: empty form is rejected
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(page.getByText('Please choose a category.')).toBeVisible()

  // Create
  await page.getByLabel('Short title').fill('Fix my TV settings')
  await page.getByRole('button', { name: /Tech/ }).click()
  await page.getByLabel('Details').fill('The TV language changed to something else.')
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(card(page, 'Fix my TV settings')).toBeVisible()

  // Edit
  await (await openCard(page, 'Fix my TV settings')).getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Short title').fill('Fix my TV language')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(card(page, 'Fix my TV language')).toBeVisible()

  // Cancel
  await (await openCard(page, 'Fix my TV language')).getByTestId('cancel').click()
  await page.getByTestId('confirm-cancel').click()
  await expect(card(page, 'Fix my TV language').getByText('Cancelled')).toBeVisible()
})

test('Youth can filter requests', async ({ page }) => {
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.locator('.request-card')).toHaveCount(7)

  await page.getByLabel('Filter by category').selectOption('Lifting')
  await expect(page.locator('.request-card')).toHaveCount(1)
  await expect(card(page, 'Carry gas tank')).toBeVisible()
})

test('Youth is limited to 2 active tasks', async ({ page }) => {
  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, 'Singpass')).getByTestId('accept').click()
  await (await openCard(page, 'Buy groceries')).getByTestId('accept').click()

  await expect(page.getByTestId('active-count')).toContainText('2 / 2')
  await expect((await openCard(page, 'Carry gas tank')).getByTestId('accept')).toBeDisabled()
})

test('Points are released only after the senior confirms', async ({ page }) => {
  // Youth accepts and marks done
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('points')).toHaveText('⭐ 120 pts')
  await (await openCard(page, 'Singpass')).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, 'Singpass')).getByTestId('mark-done').click()
  await expect(page.getByText(/Waiting for Mdm Tan Siew Lan/)).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText('⭐ 120 pts')
  await logout(page)

  // Senior confirms
  await login(page, 'Senior', 'Mdm Tan')
  await (await openCard(page, 'Singpass')).getByTestId('confirm').click()
  await expect(page.getByText(/Wei Jie earned 30 points/)).toBeVisible()
  await logout(page)

  // Youth now has the points (Medium, 45 min = 30 points)
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('points')).toHaveText('⭐ 150 pts')
})
