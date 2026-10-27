import { test, expect } from '@playwright/test'
import {
  resetApp, forgetAccounts, login, logout, switchTo, card, openCard, uniqueTitle, futureTime, fillRequest,
  postRequest, rememberRequest, acceptCard, markTaskDone, tidyUp, mockOneMap,
} from './helpers.js'

// Each group signs up one senior and one youth and reuses them (Supabase limits
// sign-ups). A test that needs a brand-new account uses a name new to its group.
// Titles include Date.now(), and tidyUp cancels each test's leftover requests.

test.beforeEach(async ({ page }) => { await resetApp(page, { keepAccounts: true }) })
test.afterEach(async ({ browser }) => { await tidyUp(browser) })

const PHYSICAL_BOX = 'This needs physical effort (for example lifting or a long walk)'

// Change what the Help Board loads, e.g. only this test's requests (the data is shared)
async function changeLoadedRequests(page, change) {
  await page.route('**/rest/v1/help_requests*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    await route.fulfill({ response, json: change(await response.json()) })
  })
}


test.describe('Posting a request', () => {
  test.beforeAll(forgetAccounts)

  test('Senior can create, edit and cancel a request, including its place', async ({ page }) => {
    const title = uniqueTitle('Fix my TV settings')
    const newTitle = uniqueTitle('Fix my TV language')
    const neededAt = futureTime(3, 15)
    const place = page.getByLabel('Where do you need help?')

    await login(page, 'Senior', 'Mdm Tan')
    await page.getByRole('link', { name: '+ Ask for Help' }).first().click()
    await fillRequest(page, { title, details: 'The TV language changed to something else.', neededAt, location: 'Blk 412 void deck' })
    await page.getByRole('button', { name: 'Post request' }).click()
    await expect(page).toHaveURL(/\/app\/requests$/)
    rememberRequest(title)
    await expect((await openCard(page, title)).getByTestId('needed-at')).toContainText('3:00 PM')

    // Edit: the form starts filled in, including the time and the place
    await (await openCard(page, title)).getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByLabel('When do you need help?')).toHaveValue(neededAt)
    await expect(place).toHaveValue('Blk 412 void deck')
    await page.getByLabel('Short title').fill(newTitle)
    await place.fill('Eunos CC entrance')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/app\/requests$/)
    rememberRequest(newTitle)
    await expect(card(page, newTitle).getByTestId('location')).toHaveText('Eunos CC entrance')
    await page.reload()
    await expect(card(page, newTitle).getByTestId('location')).toHaveText('Eunos CC entrance')

    // Cancel
    await (await openCard(page, newTitle)).getByTestId('cancel').click()
    await page.getByTestId('confirm-cancel').click()
    await expect(card(page, newTitle).getByText('Cancelled')).toBeVisible()
  })

  test('The form helps while writing, and a blank title is made for you', async ({ page }) => {
    const post = page.getByRole('button', { name: 'Post request' })
    const place = page.getByLabel('Where do you need help?')
    const placeError = page.getByText('Please write where you need help, for example your block or the CC.')
    const detailsBox = page.getByLabel('Details')
    const counter = page.getByTestId('details-count')
    const physicalBox = page.getByLabel(PHYSICAL_BOX)
    const dialog = page.getByRole('dialog')
    const onForm = /\/app\/requests\/create$/
    const typed = `Help ${Date.now()}`   // 18 characters
    const details = `Please help me read the letter from the bank ${Date.now()}`

    await login(page, 'Senior', 'Mdm Tan')
    await page.goto('/app/requests/create')

    // 1. Empty form: errors show, and focus goes to Category (the first field)
    await post.click()
    await expect(page.getByText('Please choose a category.')).toBeVisible()
    await expect(page.getByText('Please choose the day and time you need help.')).toBeVisible()
    const group = page.getByRole('group', { name: 'Category' })
    await expect(group).toHaveAttribute('aria-invalid', 'true')
    await expect(group.getByRole('button').first()).toBeFocused()
    await expect(detailsBox).toHaveAttribute('aria-invalid', 'true')

    // 2. Lifting says it is physical instead of showing the checkbox
    await expect(physicalBox).toBeVisible()
    await page.getByRole('button', { name: /Lifting/ }).click()
    await expect(page.getByTestId('always-physical')).toHaveText('This task needs physical effort.')
    await expect(physicalBox).toHaveCount(0)

    // 3. "Use my block" fills in the block
    await page.getByRole('button', { name: 'Use my block' }).click()
    await expect(place).toHaveValue('Blk 412 Eunos Cres')

    // 4. The place is required (not just spaces)
    await fillRequest(page, { title: uniqueTitle('Help me fill a form'), location: '   ' })
    await post.click()
    await expect(placeError).toBeVisible()
    await expect(page).toHaveURL(onForm)

    // 5. A time in the past is rejected
    await fillRequest(page, { title: uniqueTitle('Fix my TV settings'), neededAt: '2020-01-01T10:00' })
    await post.click()
    await expect(page.getByText('This time has already passed. Please choose a later time.')).toBeVisible()
    await expect(page).toHaveURL(onForm)

    // 6. The details counter updates while typing
    await detailsBox.fill(typed)
    await expect(counter).toHaveText('18 / 240')

    // 7. Cancel after typing asks first; "Keep editing" stays on the form
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toContainText('Leave without saving?')
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(detailsBox).toHaveValue(typed)

    // 8. A blank title is made from the category and the details
    await fillRequest(page, { title: '', category: 'Tech', details })
    await post.click()
    await expect(page).toHaveURL(/\/app\/requests$/)
    rememberRequest(details)
    await expect(card(page, details).locator('.request-toggle')).toHaveText(`Tech help: ${details}`)
  })

  test('An "Other" request shows a hint, and its physical box stays ticked', async ({ page }) => {
    const other = uniqueTitle('Move my flower pots')

    await login(page, 'Senior', 'Mdm Tan')
    await page.goto('/app/requests/create')
    await page.getByRole('button', { name: /Other/ }).click()
    await expect(page.getByText("Say clearly what you need in the title, for example 'Change a light bulb'.")).toBeVisible()
    await fillRequest(page, { title: other, category: 'Other' })
    await page.getByLabel(PHYSICAL_BOX).check()
    await page.getByRole('button', { name: 'Post request' }).click()
    rememberRequest(other)

    // Editing starts with the box ticked
    await (await openCard(page, other)).getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByLabel(PHYSICAL_BOX)).toBeChecked()
  })
})


test.describe('Youth Help Board', () => {
  test.beforeAll(forgetAccounts)

  test('Youth can filter by category, and an empty category says so', async ({ page }) => {
    const lifting = uniqueTitle('Carry gas tank')
    const tech = uniqueTitle('Set up Singpass')
    const count = page.getByTestId('request-count')
    const filter = page.getByLabel('Filter by category')

    await login(page, 'Senior', 'Mr Lim')
    await postRequest(page, { title: lifting, category: 'Lifting' })
    await postRequest(page, { title: tech, category: 'Tech' })
    await logout(page)

    // Only show these two, so the counts are exact
    await changeLoadedRequests(page, (rows) => rows.filter((r) => r.title === lifting || r.title === tech))
    await login(page, 'Youth', 'Wei Jie')
    await expect(count).toHaveText('2 requests')

    await filter.selectOption('Lifting')
    await expect(card(page, tech)).toHaveCount(0)
    await expect(count).toHaveText('1 request')

    await filter.selectOption('Translation')
    await expect(page.getByText('No requests in this category right now.')).toBeVisible()

    await page.getByRole('button', { name: 'Show all categories' }).click()
    await expect(count).toHaveText('2 requests')
  })

  test('Sorting: "Soonest first" by default, then "Newest first" and "Most points"', async ({ page }) => {
    // The sooner one is posted first (so "Newest first" shows it second) and is worth more
    const stamp = Date.now()
    const soon = `Move my cupboard ${stamp}`     // in 2 days; Hard, 90 min = 90 points
    const later = `Read my letter ${stamp}`      // in 5 days; Easy, 15 min = 5 points
    const sortBy = page.getByLabel('Sort by')

    await login(page, 'Senior', 'Mr Lim')
    await postRequest(page, { title: soon, neededAt: futureTime(2), difficulty: 'Hard', duration: '90 min' })
    await postRequest(page, { title: later, neededAt: futureTime(5), difficulty: 'Easy', duration: '15 min' })
    await switchTo(page, 'Youth', 'Wei Jie')
    await expect(card(page, later)).toBeVisible()

    const soonIsFirst = async () => {
      const titles = await page.locator('.request-toggle').allTextContents()
      return titles.indexOf(soon) < titles.indexOf(later)
    }
    const shownPoints = async () => {   // the points on these two cards, top to bottom
      const stats = await page.locator('.request-card', { hasText: String(stamp) }).getByTestId('card-stats').allTextContents()
      return stats.map((text) => Number(text.match(/⭐ (\d+) pts/)[1]))
    }

    await expect(sortBy).toHaveValue('soonest')
    await expect.poll(soonIsFirst).toBe(true)
    await sortBy.selectOption({ label: 'Newest first' })
    await expect.poll(soonIsFirst).toBe(false)
    await expect.poll(shownPoints).toEqual([5, 90])
    await sortBy.selectOption({ label: 'Most points' })
    await expect.poll(shownPoints).toEqual([90, 5])
  })

  test('A closed card shows points, time, effort and how long it has waited (youth only)', async ({ page }) => {
    const old = uniqueTitle('Help me with my phone camera')
    const fresh = uniqueTitle('Help me wrap a present')

    // Medium, 45 min = 30 points. The senior's own cards stay simple.
    await login(page, 'Senior', 'Mr Lim')
    await postRequest(page, { title: old, difficulty: 'Medium', duration: '45 min' })
    await postRequest(page, { title: fresh })
    await expect(card(page, old).getByTestId('card-stats')).toHaveCount(0)
    await logout(page)

    // We cannot post in the past, so make "old" look 3 days old
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 1000).toISOString()
    await changeLoadedRequests(page, (rows) => rows.map((r) => (r.title === old ? { ...r, created_at: threeDaysAgo } : r)))
    await login(page, 'Youth', 'Wei Jie')
    await page.mouse.move(0, 0)
    await expect(card(page, old).getByTestId('card-stats')).toHaveText('⭐ 30 pts · 45 min · Medium effort')
    await expect(card(page, old).getByTestId('accept')).toBeHidden() // still closed
    await expect(card(page, old).getByTestId('waiting')).toHaveText('Waiting for a helper for 3 days')
    await expect(card(page, fresh)).toBeVisible()
    await expect(card(page, fresh).getByTestId('waiting')).toHaveCount(0)
  })
})


test.describe('Accepting', () => {
  test.beforeAll(forgetAccounts)

  test('"I can help" asks "Can you make it?" first, then the success message gets focus', async ({ page }) => {
    const title = uniqueTitle('Help me print my photos')
    const physical = uniqueTitle('Carry my rice bag')
    const dialog = page.getByRole('dialog')
    const yes = dialog.getByRole('button', { name: 'Yes, I can help' })
    const alert = page.getByTestId('accept-success')

    await login(page, 'Senior', 'Mdm Fatimah')
    await postRequest(page, { title, neededAt: futureTime(3, 15), location: 'Eunos CC entrance' })
    await postRequest(page, { title: physical, category: 'Lifting' })
    await switchTo(page, 'Youth', 'Aisha')

    // A physical request says so
    await (await openCard(page, physical)).getByTestId('accept').click()
    await expect(dialog).toContainText('This task needs physical effort.')
    await dialog.getByRole('button', { name: 'Not now' }).click()

    // The modal shows the time and place; the success message gets focus and links to My Tasks
    await (await openCard(page, title)).getByTestId('accept').click()
    await expect(dialog).toContainText('Can you make it?')
    await expect(dialog).toContainText(/, 3:00 PM at Eunos CC entrance\./)
    await expect(dialog).not.toContainText('physical effort')
    await yes.click()
    await expect(alert).toContainText(`You accepted "${title}". It is now in My Tasks.`)
    await expect(alert).toBeFocused()
    await alert.getByRole('link', { name: 'View My Tasks' }).click()
    await expect(page).toHaveURL(/\/app\/tasks$/)
    await expect(card(page, title)).toBeVisible()
  })

  test('Youth is limited to 2 active tasks; withdrawing puts a task back on the Help Board', async ({ page }) => {
    const titles = [uniqueTitle('Help with phone'), uniqueTitle('Help with laptop'), uniqueTitle('Help with tablet')]
    const activeCount = page.getByTestId('active-count')

    await login(page, 'Senior', 'Mdm Fatimah')
    for (const title of titles) await postRequest(page, { title })
    await switchTo(page, 'Youth', 'Daniel')   // new, so no tasks yet

    await expect(activeCount).toContainText('0 / 2')
    await acceptCard(page, titles[0])
    await expect(activeCount).toContainText('1 / 2')
    await acceptCard(page, titles[1])
    await expect(activeCount).toContainText('2 / 2')
    await expect((await openCard(page, titles[2])).getByTestId('accept')).toBeDisabled()

    // Withdraw asks first
    await page.getByRole('link', { name: 'My Tasks', exact: true }).click()
    await (await openCard(page, titles[0])).getByTestId('withdraw').click()
    await expect(page.getByRole('dialog')).toContainText('Withdraw from this task?')
    await page.getByTestId('confirm-withdraw').click()
    await expect(card(page, titles[0])).toHaveCount(0)
    await page.getByRole('link', { name: 'Help Board' }).click()
    await expect((await openCard(page, titles[0])).getByTestId('accept')).toBeEnabled()
  })

  test('If the request was cancelled meanwhile, accepting shows why and the card goes away', async ({ page, browser }) => {
    const title = uniqueTitle('Help me with my phone bill')

    await login(page, 'Senior', 'Mdm Fatimah')
    await postRequest(page, { title })
    await switchTo(page, 'Youth', 'Aisha')
    await expect(card(page, title)).toBeVisible()

    // Meanwhile, in another browser, the senior cancels it
    const seniorPage = await (await browser.newContext()).newPage()
    await login(seniorPage, 'Senior', 'Mdm Fatimah')
    await card(seniorPage, title).getByTestId('cancel').click()
    await seniorPage.getByTestId('confirm-cancel').click()
    await expect(card(seniorPage, title).locator('.status-pill')).toHaveText('Cancelled')
    await seniorPage.context().close()

    await acceptCard(page, title)
    await expect(page.getByRole('alert')).toHaveText('Sorry, this request is no longer open.')
    await expect(page.getByRole('alert')).toBeFocused()
    await expect(card(page, title)).toHaveCount(0)
  })
})


test.describe('My Tasks', () => {
  test.beforeAll(forgetAccounts)
  test('Points are released only after the senior confirms, and finished requests move to Past', async ({ page }) => {
    const toCancel = uniqueTitle('Buy bread')
    const toComplete = uniqueTitle('Set up my new phone')   // Medium, 45 min = 30 points
    const points = page.getByTestId('points')
    const inList = (testId, title) => page.getByTestId(testId).locator('.request-card', { hasText: title })

    await login(page, 'Senior', 'Uncle Raj')
    await postRequest(page, { title: toCancel, category: 'Grocery' })
    await postRequest(page, { title: toComplete, difficulty: 'Medium', duration: '45 min' })

    // A cancelled request moves to Past
    await (await openCard(page, toCancel)).getByTestId('cancel').click()
    await page.getByTestId('confirm-cancel').click()
    await expect(inList('past-requests', toCancel)).toContainText('Cancelled')
    await expect(inList('active-requests', toCancel)).toHaveCount(0)

    // The youth helps and marks it done: no points yet
    await switchTo(page, 'Youth', 'Siti')
    await expect(points).toHaveText('⭐ 0 pts')
    await acceptCard(page, toComplete)
    await markTaskDone(page, toComplete)
    await expect(page.getByText(/Waiting for Uncle Raj to confirm/)).toBeVisible()
    await expect(inList('active-tasks', toComplete)).toBeVisible()
    await expect(points).toHaveText('⭐ 0 pts')

    // The senior confirms: a thank-you message gets focus, and the request moves to Past
    await switchTo(page, 'Senior', 'Uncle Raj')
    await expect(inList('active-requests', toComplete).locator('.status-pill')).toHaveText("Please check: helper says it's done")
    await inList('active-requests', toComplete).getByTestId('confirm').click()
    const message = page.getByTestId('confirm-success')
    await expect(message).toBeFocused()
    await expect(message).toContainText('Siti earned 30 points')
    await message.getByRole('button', { name: 'Close message' }).click()
    await expect(message).toHaveCount(0)
    await expect(inList('past-requests', toComplete)).toContainText('Done')
    await expect(inList('active-requests', toComplete)).toHaveCount(0)

    // The youth now has the points, and the task is in Past
    await switchTo(page, 'Youth', 'Siti')
    await expect(points).toHaveText('⭐ 30 pts')
    await page.getByRole('link', { name: 'My Tasks', exact: true }).click()
    await expect(inList('past-tasks', toComplete)).toContainText('Done, points earned')
    await expect(inList('active-tasks', toComplete)).toHaveCount(0)
  })
})


test.describe('Map', () => {
  test.beforeAll(forgetAccounts)

  test('"View map" shows where to meet, closes with Escape or the dark area, and says when a place is not found', async ({ page }) => {
    const searches = await mockOneMap(page)
    const title = uniqueTitle('Walk with me to the CC')
    const notFound = uniqueTitle('Help me at the bus stop')
    const dialog = page.getByRole('dialog')
    const leaflet = dialog.locator('.leaflet-container')

    await login(page, 'Senior', 'Mr Lim')
    await postRequest(page, { title, location: 'Eunos CC entrance' })
    await postRequest(page, { title: notFound, location: 'Bus stop near my home' })
    expect(searches.count).toBe(0)   // OneMap is not asked when the list loads

    // A place OneMap knows
    const found = await openCard(page, title)
    await found.getByTestId('view-map').click()
    await expect(dialog).toContainText('Where to meet')
    await expect(dialog.getByTestId('map-location')).toContainText('Eunos CC entrance')
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await expect(dialog.getByTestId('request-map')).toBeVisible()
    await expect(leaflet).toHaveCount(1)
    await expect(dialog.getByTestId('map-match')).toContainText('EUNOS COMMUNITY CLUB')
    await expect(dialog.getByTestId('map-match')).toContainText('180 BEDOK RESERVOIR ROAD')
    await expect(dialog).toContainText('This is our best match. Please check the details with the requester.')
    expect(searches.count).toBe(1)

    // Escape closes it, but not the card behind it
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(found.locator('.request-toggle')).toHaveAttribute('aria-expanded', 'true')

    // Second time: still one map with the one circle marker; clicking the dark area closes it
    await found.getByTestId('view-map').click()
    await expect(leaflet).toHaveCount(1)
    await expect(dialog.locator('.leaflet-interactive')).toHaveCount(1)
    await page.locator('.modal').click({ position: { x: 5, y: 5 } })
    await expect(dialog).toHaveCount(0)

    // A place OneMap cannot find shows a message instead of a map
    await (await openCard(page, notFound)).getByTestId('view-map').click()
    await expect(dialog.getByTestId('map-not-found')).toHaveText(
      'We could not find this place on the map. The meeting place is: Bus stop near my home.')
    await expect(dialog.getByTestId('request-map')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
  })
})
