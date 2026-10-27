import { expect } from '@playwright/test'

// Accounts are real Supabase users, so each test signs up its own fresh ones.
// Point .env at a separate TEST Supabase project if you can, so these do not
// mix with the team's real data.
export const TEST_PASSWORD = 'kampung-test-123'
const EMAIL_DOMAIN = 'example.com'

// The accounts made so far, by name, so logging in as the same name again
// (after logout) reuses the same account instead of signing up a new one
const accounts = new Map()

// The name of the person who logged in last (set by login, cleared by logout)
let loggedInAs = null

// Requests posted in the current test, so tidyUp() can cancel the ones left open
const posted = []

// A birth year that puts someone in an age group today
const thisYear = new Date().getFullYear()
export const birthYearFor = { Senior: thisYear - 75, Adult: thisYear - 35, Youth: thisYear - 19, Minor: thisYear - 15 }

export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`
}

// Start every test logged out. Supabase keeps the session in localStorage, so
// clearing it logs out. There is no sample data any more: the data lives in
// Supabase, so each test creates what it needs (see postRequest below).
// By default every test gets new accounts. With { keepAccounts: true } the
// accounts from earlier tests are reused (call forgetAccounts() to start over).
export async function resetApp(page, { keepAccounts = false } = {}) {
  if (!keepAccounts) accounts.clear()
  posted.length = 0
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

// Start a new set of accounts, for example at the start of a test.describe group
export function forgetAccounts() {
  accounts.clear()
}

// role is 'Senior' or 'Youth'. The first time a name is used, a new
// account of that age group is signed up; after that, it logs in to it again.
// Seniors land on My Requests (/app/requests) and everyone else on the Help Board (/app).
export async function login(page, role, name) {
  loggedInAs = name
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
  loggedInAs = null
}

// Log out, then log in as someone else
export async function switchTo(page, role, name) {
  await logout(page)
  await login(page, role, name)
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
  difficulty = 'Easy', duration = '30 min', neededAt = futureTime(), location = 'Eunos CC entrance' }) {
  await page.getByLabel('Short title').fill(title)
  await page.getByRole('button', { name: new RegExp(category) }).click()
  await page.getByLabel('Details').fill(details)
  await page.getByLabel('When do you need help?').fill(neededAt)
  await page.getByLabel('Where do you need help?').fill(location)
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
  rememberRequest(request.title)
}

// Note a request the logged-in senior posted, so tidyUp() can cancel it later.
// postRequest does this for you; call it yourself if a test presses "Post request".
// text is the title, or any text on the card that is unique to it.
export function rememberRequest(text) {
  posted.push({ senior: loggedInAs, text })
}

// Accept a request on the youth Help Board: "I can help", then "Yes, I can help" in the modal
export async function acceptCard(page, title) {
  await (await openCard(page, title)).getByTestId('accept').click()
  await page.getByTestId('confirm-accept').click()
}

// A senior posts a request and a youth accepts it.
// Ends logged in as the youth, on the Help Board.
export async function postAndAccept(page, { senior, youth, request }) {
  await login(page, 'Senior', senior)
  await postRequest(page, request)
  await logout(page)
  await login(page, 'Youth', youth)
  await acceptCard(page, request.title)
  await expect(page.getByTestId('accept-success')).toBeVisible()
}

// The logged-in youth marks a task as done, from My Tasks
export async function markTaskDone(page, title) {
  await page.getByRole('link', { name: 'My Tasks', exact: true }).click()
  await (await openCard(page, title)).getByTestId('mark-done').click()
  await expect(card(page, title).locator('.status-pill')).toHaveText('Waiting for the senior to confirm')
}

// The logged-in senior confirms a finished task, on My Requests
export async function confirmTaskDone(page, title) {
  await card(page, title).getByTestId('confirm').click()
  await expect(page.getByTestId('confirm-success')).toBeVisible()
}

// After a test: cancel the requests it posted that are still open or accepted,
// so they do not stay on everyone's Help Board. Each senior logs in (in a
// separate browser window) and presses "Cancel request", like a real user.
// Requests that are done, already cancelled or waiting to confirm are left alone.
export async function tidyUp(browser) {
  const toTidy = posted.splice(0)
  const seniors = [...new Set(toTidy.map((r) => r.senior))].filter((name) => accounts.has(name))

  for (const senior of seniors) {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginWith(page, accounts.get(senior))
      const active = page.getByTestId('active-requests')
      await expect(active).toBeVisible()
      for (const { text } of toTidy.filter((r) => r.senior === senior)) {
        const cancel = active.locator('.request-card', { hasText: text }).getByTestId('cancel')
        if ((await cancel.count()) === 0) continue
        await cancel.click()
        await page.getByTestId('confirm-cancel').click()
        await expect(cancel).toHaveCount(0)
      }
    } finally {
      await context.close()
    }
  }
}

// Fixed OneMap answers, so the tests never call the real API. A place with
// "Eunos" in it has one match; anything else has none. Returns how many
// searches were sent so far.
export const EUNOS_CC = {
  SEARCHVAL: 'EUNOS COMMUNITY CLUB',
  ADDRESS: '180 BEDOK RESERVOIR ROAD EUNOS COMMUNITY CLUB SINGAPORE 479220',
  POSTAL: '479220',
  LATITUDE: '1.32964',
  LONGITUDE: '103.90538',
}
export async function mockOneMap(page) {
  const searches = { count: 0 }
  await page.route('**/api/common/elastic/search**', async (route) => {
    searches.count++
    const searchVal = new URL(route.request().url()).searchParams.get('searchVal') ?? ''
    const results = searchVal.includes('Eunos') ? [EUNOS_CC] : []
    await route.fulfill({ json: { found: results.length, totalNumPages: 1, pageNum: 1, results } })
  })
  await page.route('**/maps/tiles/**', (route) => route.abort())
  return searches
}
