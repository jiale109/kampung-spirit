import { expect } from '@playwright/test'

// Accounts are real Supabase users, so each test signs up its own fresh ones.
// Point .env at a separate TEST Supabase project if you can, so these do not
// mix with the team's real data.
// Meets the sign-up rules: 8+ characters, capital, small letter, number, special character
export const TEST_PASSWORD = 'Kampung-test-123'
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

// Start every test logged out. Supabase keeps the session in localStorage, so
// clearing it logs out. There is no sample data any more: the data lives in
// Supabase, so each test creates what it needs (see postRequest below).
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
  await page.getByLabel('Type your password again').fill(TEST_PASSWORD)
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
// Seniors land on My Requests (/app/requests) and everyone else on the Help Board (/app).
export async function login(page, role, name) {
  const existing = accounts.get(name)
  if (existing) {
    await loginWith(page, existing)
  } else {
    accounts.set(name, await signUp(page, { name, birthYear: birthYearFor[role] }))
  }
  await expect(page).toHaveURL(role === 'Senior' ? /\/app\/requests$/ : /\/app$/)
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

// Request cards only show their buttons after a click or tap on the title, so
// open it first. Use this before clicking a button inside a card. A card that is
// already open is left open (clicking again would close it).
export async function openCard(page, title) {
  const found = card(page, title)
  const toggle = found.locator('.request-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return found
}

// A title no other test (or earlier run) has used, so cards are easy to find
// even though everyone shares the same Supabase data
export function uniqueTitle(text) {
  return `${text} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// A local time daysFromNow days ahead, in the format the "When" input takes: 'YYYY-MM-DDTHH:mm'
export function futureTime(daysFromNow = 2, hour = 15) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

// Fill in the request form (does not press the button)
export async function fillRequest(page, { title, category = 'Tech', details = 'Please help me with this, thank you.',
  difficulty = 'Easy', duration = '30 min', neededAt = futureTime() }) {
  await page.getByLabel('Short title').fill(title)
  await page.getByRole('button', { name: new RegExp(category) }).click()
  await page.getByLabel('Details').fill(details)
  await page.getByLabel('When do you need help?').fill(neededAt)
  await page.getByLabel('How hard?').selectOption(difficulty)
  await page.getByLabel('How long?').selectOption({ label: duration })
}

// Post a request as the logged-in person, through the form. Ends on My Requests.
export async function postRequest(page, request) {
  await page.goto('/app/requests/create')
  await fillRequest(page, request)
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(page).toHaveURL(/\/app\/requests$/)
  await expect(card(page, request.title)).toBeVisible()
}
