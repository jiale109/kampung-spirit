import { expect } from '@playwright/test'

// Accounts are real Supabase users, so each test signs up its own fresh ones.
// Point .env at a separate TEST Supabase project if you can, so these do not
// mix with the team's real data.
// Meets the sign-up rules: 8+ characters, capital, small letter, number, special character
export const TEST_PASSWORD = 'Kampung-test-123'
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
/*
  'Which day?' is the calendar in components/DayPicker.vue, not a <select>,
  so a day is PRESSED rather than chosen from a list. 0 is today, 1 is
  tomorrow, and so on.

  This lives here because the hangout form and the skill swap form both use
  that calendar. For a date further out use chooseDayAndTime() below, which
  walks whole months; this one steps forward at most once, which is all that
  today or tomorrow ever needs.
*/
export function dayFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function chooseDay(page, n) {
  const iso = dayFromToday(n)
  let cell = page.getByTestId(`day-${iso}`)
  if ((await cell.count()) === 0) {
    await page.getByTestId('next-month').click()
    cell = page.getByTestId(`day-${iso}`)
  }
  await cell.click()
}

export async function resetApp(page, { keepAccounts = false } = {}) {
  // Sign up makes people choose their block from OneMap, so every test that
  // signs up would otherwise call a live government API. This also stops the
  // map downloading its tiles.
  await mockOneMap(page)
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
  await page.getByLabel('Type your password again').fill(TEST_PASSWORD)
  // The block is chosen from OneMap's list now, not typed
  await choosePlace(page, block)
  await expect(page.getByTestId('chosen-address')).toBeVisible()
  await page.getByLabel('Day').selectOption('5')
  await page.getByLabel('Month').selectOption({ label: 'March' })
  await page.getByLabel('Year').fill(String(birthYear))
}

/*
  Supabase lets one address create only 30 accounts in any 5 minutes, and a
  whole run needs more than twice that. Being turned away for it is nothing to
  do with the test: wait for the window to roll on and try the same person
  again. Nothing below waits unless the limit has actually been hit, so a run
  that stays under it is no slower than before.

  Better, if you can: raise the limit (Supabase -> Authentication -> Rate
  Limits), or point .env at a Supabase project of your own for testing. Then
  none of this ever runs.
*/
const RATE_LIMIT_ALERT = 'Too many accounts have been created'
const SIGNUP_TRIES = 6

export async function signUp(page, { name, birthYear, block }) {
  for (let attempt = 1; ; attempt++) {
    const email = uniqueEmail()
    await fillSignUp(page, { name, email, birthYear, block })
    await page.getByRole('button', { name: 'Create account' }).click()

    /*
      Two things can happen next, so wait for whichever comes first rather
      than guessing which to look for: either the account is made and we
      leave /register, or the alert appears. The .then(ok, fail) pair on each
      is what stops the one that loses the race rejecting on its own later.
    */
    const outcome = await Promise.race([
      page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 20000 })
        .then(() => 'made', () => 'unclear'),
      page.getByText(RATE_LIMIT_ALERT).waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'turned away', () => 'unclear'),
    ])

    // 'unclear' is something else going wrong. Hand it back and let the test say
    // what it expected, rather than hiding a real fault behind a retry.
    if (outcome !== 'turned away') return email

    /*
      Give up loudly rather than quietly. Returning an email for an account
      that was never made would file it under this person's name, and every
      later test in the file would then try to log in to something that does
      not exist - a confusing failure a long way from its cause.
    */
    if (attempt === SIGNUP_TRIES) {
      throw new Error(
        `Supabase turned away ${SIGNUP_TRIES} sign-ups in a row for "${name}". It allows `
        + '30 in any 5 minutes from one address. Raise it under Authentication -> Rate '
        + 'Limits, or point .env at a Supabase project of your own for testing.',
      )
    }

    // Some randomness, so workers waiting together do not all come back at once
    await page.waitForTimeout(20000 + Math.floor(Math.random() * 15000))
  }
}

export async function loginWith(page, email, password = TEST_PASSWORD) {
  await page.goto('/login')
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
  // Supabase can take a while to create an account, especially on the first sign-up of a run
  await expect(page).toHaveURL(role === 'Senior' ? /\/app\/requests$/ : /\/app$/, { timeout: 15000 })
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

// A local time daysFromNow days ahead, as 'YYYY-MM-DDTHH:mm' (fillRequest splits it into day and time)
export function futureTime(daysFromNow = 2, hour = 15) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

// Choose the meeting place on the request form through the map search
// (OneMap is mocked, see mockOneMap). The name box is filled in by the search.
export async function choosePlace(page, search = 'Eunos') {
  if (!mockedPages.has(page)) await mockOneMap(page)
  await page.getByTestId('place-search').fill(search)
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
}

// Choose 'YYYY-MM-DDTHH:mm' on the request form: press the day on the calendar
// (stepping back or forward a month at a time until it is shown), then pick the time
export async function chooseDayAndTime(page, neededAt) {
  const [date, time] = neededAt.split('T')
  const day = page.getByTestId(`day-${date}`)
  const monthLabel = page.getByTestId('month-label')
  // Only days of the month shown have a button, so any one of them says which month that is
  const shownDay = page.getByTestId('day-picker').locator('[data-testid^="day-"]').first()
  await expect(monthLabel).toBeVisible()
  // The calendar covers about two months, so a few steps is always enough
  for (let steps = 0; steps < 3 && (await day.count()) === 0; steps++) {
    const shownMonth = (await shownDay.getAttribute('data-testid')).slice('day-'.length, 'day-YYYY-MM'.length)
    const before = await monthLabel.textContent()
    await page.getByTestId(date.slice(0, 7) < shownMonth ? 'previous-month' : 'next-month').click()
    await expect(monthLabel).not.toHaveText(before)
  }
  await day.click()
  await page.getByLabel('What time?').selectOption(time)
}

// Fill in the request form (does not press the button).
// place is what to search for on the map (null to leave the map alone), and
// location is then typed into the name box (null to keep the search's name).
export async function fillRequest(page, { title, category = 'Tech', details = 'Please help me with this, thank you.',
  difficulty = 'Easy', duration = '30 min', neededAt = futureTime(), place = 'Eunos', location = 'Eunos CC entrance' }) {
  await page.getByLabel('Short title').fill(title)
  await page.getByRole('button', { name: new RegExp(category) }).click()
  await page.getByLabel('Details').fill(details)
  await chooseDayAndTime(page, neededAt)
  if (place !== null) await choosePlace(page, place)
  if (location !== null) await page.getByLabel('What is this place called?').fill(location)
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

// The HDB block the tests sign up from. Real OneMap indexes it the way it is
// written here, not as 'Blk 412 Eunos Cres': expandAddress() in lib/onemap.js
// is what turns one into the other, and this fixture is what proves it.
export const BLK_412 = {
  SEARCHVAL: '412 EUNOS CRESCENT',
  ADDRESS: '412 EUNOS CRESCENT SINGAPORE 400412',
  POSTAL: '400412',
  LATITUDE: '1.32278',
  LONGITUDE: '103.90304',
}

// Somewhere on the other side of the island, for a test that MOVES house:
// a new address has to be far enough away to be plainly a different place.
export const BLK_120_BISHAN = {
  SEARCHVAL: '120 BISHAN STREET 12',
  ADDRESS: '120 BISHAN STREET 12 SINGAPORE 570120',
  POSTAL: '570120',
  LATITUDE: '1.35098',
  LONGITUDE: '103.84851',
}

/*
  Answer each search with the place it actually asked for, rather than one
  fixed reply for everything. The block is looked at first because its name
  has 'eunos' in it too, so the other way round it could never be found.
*/
function placesFor(searchVal) {
  const search = searchVal.toLowerCase()
  if (search.includes('eunos cres') || search.includes('412')) return [BLK_412]
  if (search.includes('eunos')) return [EUNOS_CC]
  if (search.includes('bishan')) return [BLK_120_BISHAN]
  return []
}

const mockedPages = new WeakSet()
export async function mockOneMap(page) {
  mockedPages.add(page)
  const searches = { count: 0 }
  await page.route('**/api/common/elastic/search**', async (route) => {
    searches.count++
    const searchVal = new URL(route.request().url()).searchParams.get('searchVal') ?? ''
    // lib/onemap.js sends the search in small letters ('eunos'), so ignore capitals
    const results = placesFor(searchVal)
    await route.fulfill({ json: { found: results.length, totalNumPages: 1, pageNum: 1, results } })
  })
  await page.route('**/maps/tiles/**', (route) => route.abort())
  return searches
}
