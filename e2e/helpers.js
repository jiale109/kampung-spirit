import { expect } from '@playwright/test'

// Start every test from a clean browser with the sample data
export async function resetApp(page) {
  await page.goto('/landing')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

// role is 'Senior' or 'Youth', name is the demo account's name
export async function login(page, role, name) {
  await page.goto('/landing')
  await page.getByRole('button', { name: role, exact: true }).click()
  const option = await page.locator('#account option', { hasText: name }).textContent()
  await page.getByLabel('Demo account').selectOption({ label: option })
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page).toHaveURL(role === 'Senior' ? /\/senior$/ : /\/youth$/)
}

export async function logout(page) {
  await page.locator('a.dropdown-toggle').click()
  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/landing$/)
}

// Find one request card by part of its title
export function card(page, title) {
  return page.locator('.request-card', { hasText: title })
}

// Request cards only show their buttons when the mouse is over them (or after
// a tap), so hover first. Use this before clicking a button inside a card.
export async function openCard(page, title) {
  const found = card(page, title)
  await found.hover()
  return found
}
