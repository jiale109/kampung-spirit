import { expect } from '@playwright/test'

// Accounts are real Supabase users, so each test signs up its own fresh ones.
// Point .env at a separate TEST Supabase project if you can, so these do not
// mix with the team's real data.
export const TEST_PASSWORD = 'kampung-test-123'
const EMAIL_DOMAIN = 'example.com'

// The accounts made in the current test, by name, so logging in as the same
// name again (after logout) reuses the same account
const accounts = new Map()

// A birth year that puts someone in an age group today
const thisYear = new Date().getFullYear()
export const birthYearFor = { Senior: thisYear - 75, Adult: thisYear - 35, Youth: thisYear - 19, Minor: thisYear - 15 }

export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`
}

// Start every test from a clean browser, logged out, with the sample data
export async function resetApp(page) {
  accounts.clear()
  await page.goto('/landing')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

// Fill in the sign-up form (does not press the button)
export async function fillSignUp(page, { name, email, birthYear, block = 'Blk 412 Eunos Cres' }) {
  await page.goto('/register')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByLabel('Block and street').fill(block)
  await page.getByLabel('Day').selectOption('5')
  await page.getByLabel('Month').selectOption({ label: 'March' })
  await page.getByLabel('Year').fill(String(birthYear))
}

export async function signUp(page, { name, birthYear, block }) {
  const email = uniqueEmail()
  await fillSignUp(page, { name, email, birthYear, block })
  await page.getByRole('button', { name: 'Create account' }).click()
  return email
}

export async function loginWith(page, email, password = TEST_PASSWORD) {
  await page.goto('/landing')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

// role is 'Senior' or 'Youth'. The first time a name is used in a test, a new
// account of that age group is signed up; after that, it logs in to it again.
// Seniors land on /senior and everyone else on /app (until the pages are merged).
export async function login(page, role, name) {
  const existing = accounts.get(name)
  if (existing) {
    await loginWith(page, existing)
  } else {
    accounts.set(name, await signUp(page, { name, birthYear: birthYearFor[role] }))
  }
  await expect(page).toHaveURL(role === 'Senior' ? /\/senior$/ : /\/app$/)
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
