import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard, uniqueTitle, futureTime, fillRequest, postRequest } from './helpers.js'

// Every test signs up its own people and posts its own requests (with unique
// titles), so the tests do not depend on each other or on what is in Supabase.

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('Senior can create, edit and cancel a request', async ({ page }) => {
  const title = uniqueTitle('Fix my TV settings')
  const newTitle = uniqueTitle('Fix my TV language')

  await login(page, 'Senior', 'Mdm Tan')
  await page.getByRole('link', { name: '+ Ask for Help' }).first().click()

  // Validation: an empty form is rejected
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(page.getByText('Please choose a category.')).toBeVisible()
  await expect(page.getByText('Please choose the day and time you need help.')).toBeVisible()

  // Validation: a time in the past is rejected
  await fillRequest(page, { title, details: 'The TV language changed to something else.', neededAt: '2020-01-01T10:00' })
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(page.getByText('This time has already passed. Please choose a later time.')).toBeVisible()

  // Create
  const neededAt = futureTime(3, 15)
  await page.getByLabel('When do you need help?').fill(neededAt)
  await page.getByRole('button', { name: 'Post request' }).click()
  await expect(page).toHaveURL(/\/app\/requests$/)
  await expect(card(page, title)).toBeVisible()
  await expect((await openCard(page, title)).getByTestId('needed-at')).toContainText('3:00 PM')

  // Edit: the form starts filled in, including the time
  await (await openCard(page, title)).getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByLabel('When do you need help?')).toHaveValue(neededAt)
  await page.getByLabel('Short title').fill(newTitle)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(card(page, newTitle)).toBeVisible()

  // Cancel
  await (await openCard(page, newTitle)).getByTestId('cancel').click()
  await page.getByTestId('confirm-cancel').click()
  await expect(card(page, newTitle).getByText('Cancelled')).toBeVisible()
})

test("Youth sees a senior's new request and can filter by category", async ({ page }) => {
  const lifting = uniqueTitle('Carry gas tank')
  const tech = uniqueTitle('Set up Singpass')

  await login(page, 'Senior', 'Mr Lim')
  await postRequest(page, { title: lifting, category: 'Lifting' })
  await postRequest(page, { title: tech, category: 'Tech' })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await expect(card(page, lifting)).toBeVisible()
  await expect(card(page, tech)).toBeVisible()

  await page.getByLabel('Filter by category').selectOption('Lifting')
  await expect(card(page, lifting)).toBeVisible()
  await expect(card(page, tech)).toHaveCount(0)
})

test('Youth is limited to 2 active tasks', async ({ page }) => {
  const titles = [uniqueTitle('Help with phone'), uniqueTitle('Help with laptop'), uniqueTitle('Help with tablet')]

  await login(page, 'Senior', 'Mdm Fatimah')
  for (const title of titles) await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('active-count')).toContainText('0 / 2')
  await (await openCard(page, titles[0])).getByTestId('accept').click()
  await expect(page.getByTestId('active-count')).toContainText('1 / 2')
  await (await openCard(page, titles[1])).getByTestId('accept').click()

  await expect(page.getByTestId('active-count')).toContainText('2 / 2')
  await expect((await openCard(page, titles[2])).getByTestId('accept')).toBeDisabled()
})

test('Points are released only after the senior confirms', async ({ page }) => {
  const title = uniqueTitle('Set up my new phone')

  // Medium, 45 min = 10 x 2 x 1.5 = 30 points
  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title, difficulty: 'Medium', duration: '45 min' })
  await logout(page)

  // Youth accepts and marks done (a new account starts with 0 points)
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('points')).toHaveText('⭐ 0 pts')
  await (await openCard(page, title)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, title)).getByTestId('mark-done').click()
  await expect(page.getByText(/Waiting for Mdm Tan to confirm/)).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText('⭐ 0 pts')
  await logout(page)

  // Senior confirms (the card is already open)
  await login(page, 'Senior', 'Mdm Tan')
  await card(page, title).getByTestId('confirm').click()
  await expect(page.getByText(/Wei Jie earned 30 points/)).toBeVisible()
  await logout(page)

  // Youth now has the points
  await login(page, 'Youth', 'Wei Jie')
  await expect(page.getByTestId('points')).toHaveText('⭐ 30 pts')
})

test('Completed and cancelled requests move to Past', async ({ page }) => {
  const toCancel = uniqueTitle('Buy bread')
  const toComplete = uniqueTitle('Fix my radio')
  const active = page.getByTestId('active-requests')
  const past = page.getByTestId('past-requests')

  await login(page, 'Senior', 'Uncle Raj')
  await postRequest(page, { title: toCancel, category: 'Grocery' })
  await postRequest(page, { title: toComplete })

  // Cancelled
  await (await openCard(page, toCancel)).getByTestId('cancel').click()
  await page.getByTestId('confirm-cancel').click()
  await expect(past.locator('.request-card', { hasText: toCancel })).toContainText('Cancelled')
  await expect(active.locator('.request-card', { hasText: toCancel })).toHaveCount(0)
  await logout(page)

  // Completed: a youth helps, the senior confirms
  await login(page, 'Youth', 'Aisha')
  await (await openCard(page, toComplete)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, toComplete)).getByTestId('mark-done').click()
  await logout(page)

  await login(page, 'Senior', 'Uncle Raj')
  await active.locator('.request-card', { hasText: toComplete }).getByTestId('confirm').click()
  await expect(past.locator('.request-card', { hasText: toComplete })).toContainText('Completed')
  await expect(active.locator('.request-card', { hasText: toComplete })).toHaveCount(0)
})

test('"Soonest first" puts the earliest time at the top', async ({ page }) => {
  // The sooner one is posted first, so "Newest first" shows it second
  const soon = uniqueTitle('Read my letter')
  const later = uniqueTitle('Teach me WhatsApp')

  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title: soon, neededAt: futureTime(2) })
  await postRequest(page, { title: later, neededAt: futureTime(5) })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await expect(card(page, soon)).toBeVisible()
  await expect(card(page, later)).toBeVisible()
  // true when "soon" is shown above "later"
  const soonIsFirst = async () => {
    const titles = await page.locator('.request-toggle').allTextContents()
    return titles.indexOf(soon) < titles.indexOf(later)
  }

  await expect.poll(soonIsFirst).toBe(false)
  await page.getByLabel('Sort by').selectOption({ label: 'Soonest first' })
  await expect.poll(soonIsFirst).toBe(true)
})

test('Withdraw asks first, then the task goes back on the Help Board', async ({ page }) => {
  const title = uniqueTitle('Change my light bulb')

  await login(page, 'Senior', 'Mr Lim')
  await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, title)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, title)).getByTestId('withdraw').click()

  await expect(page.getByRole('dialog')).toContainText('Withdraw from this task?')
  await page.getByTestId('confirm-withdraw').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(card(page, title)).toHaveCount(0)

  await page.getByRole('link', { name: 'Help Board' }).click()
  await expect((await openCard(page, title)).getByTestId('accept')).toBeEnabled()
})

test('A completed task moves to Past in My Tasks', async ({ page }) => {
  const title = uniqueTitle('Sort my medicine')
  const past = page.getByTestId('past-tasks')

  await login(page, 'Senior', 'Uncle Raj')
  await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Aisha')
  await (await openCard(page, title)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, title)).getByTestId('mark-done').click()
  await expect(page.getByTestId('active-tasks')).toContainText(title)
  await logout(page)

  await login(page, 'Senior', 'Uncle Raj')
  await card(page, title).getByTestId('confirm').click()
  await expect(page.getByTestId('past-requests')).toContainText(title)
  await logout(page)

  await login(page, 'Youth', 'Aisha')
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await expect(past.locator('.request-card', { hasText: title })).toContainText('Completed')
  await expect(page.getByTestId('active-tasks').locator('.request-card', { hasText: title })).toHaveCount(0)
})

test('The senior sees when the helper will come', async ({ page }) => {
  const title = uniqueTitle('Fix my fan')

  await login(page, 'Senior', 'Mdm Fatimah')
  await postRequest(page, { title, neededAt: futureTime(3, 15) })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, title)).getByTestId('accept').click()
  await expect(page.getByText(`You accepted "${title}"`)).toBeVisible()
  await logout(page)

  await login(page, 'Senior', 'Mdm Fatimah')
  await expect(await openCard(page, title)).toContainText(/Wei Jie will help on .+, 3:00 PM/)
})

test('A closed card shows when and where', async ({ page }) => {
  const title = uniqueTitle('Read my bill')

  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title, neededAt: futureTime(3, 15) })
  // The senior's own list already knows where, so only the time shows
  await expect(card(page, title).getByTestId('card-summary')).toContainText('3:00 PM')
  await expect(card(page, title).getByTestId('card-summary')).not.toContainText('Blk')
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await page.mouse.move(0, 0)
  const summary = card(page, title).getByTestId('card-summary')
  await expect(summary).toContainText('3:00 PM')
  await expect(summary).toContainText('Blk 412 Eunos Cres')
  await expect(card(page, title).getByTestId('accept')).toBeHidden() // still closed
})

test('A request waiting for the senior to confirm is listed first', async ({ page }) => {
  // Posted first and needed later, so without the "needs you" order it would be last
  const toConfirm = uniqueTitle('Fix my clock')
  const other = uniqueTitle('Water my plants')

  await login(page, 'Senior', 'Mr Lim')
  await postRequest(page, { title: toConfirm, neededAt: futureTime(5) })
  await postRequest(page, { title: other, neededAt: futureTime(2) })
  await logout(page)

  await login(page, 'Youth', 'Aisha')
  await (await openCard(page, toConfirm)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, toConfirm)).getByTestId('mark-done').click()
  await expect(page.getByText(/Waiting for Mr Lim to confirm/)).toBeVisible()
  await logout(page)

  await login(page, 'Senior', 'Mr Lim')
  const titles = page.getByTestId('active-requests').locator('.request-toggle')
  await expect(titles).toHaveCount(2)
  await expect(titles.first()).toHaveText(toConfirm)
})

test('An empty category says so and can show all categories again', async ({ page }) => {
  const title = uniqueTitle('Set up my email')

  await login(page, 'Senior', 'Mdm Fatimah')
  await postRequest(page, { title, category: 'Tech' })
  await logout(page)

  // Everyone shares the same Supabase data, so let the youth see only this request
  await page.route('**/rest/v1/help_requests*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const rows = (await response.json()).filter((r) => r.title === title)
    await route.fulfill({ response, json: rows })
  })

  await login(page, 'Youth', 'Wei Jie')
  await expect(card(page, title)).toBeVisible()
  await expect(page.getByTestId('request-count')).toHaveText('1 request')

  await page.getByLabel('Filter by category').selectOption('Lifting')
  await expect(card(page, title)).toHaveCount(0)
  await expect(page.getByText('No requests in this category right now.')).toBeVisible()
  await expect(page.getByTestId('request-count')).toHaveText('0 requests')

  await page.getByRole('button', { name: 'Show all categories' }).click()
  await expect(page.getByLabel('Filter by category')).toHaveValue('')
  await expect(card(page, title)).toBeVisible()
  await expect(page.getByTestId('request-count')).toHaveText('1 request')
})

test('After accepting, the success alert gets focus and links to My Tasks', async ({ page }) => {
  const title = `Help me pay my bill online ${Date.now()}`

  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, title)).getByTestId('accept').click()

  const alert = page.getByTestId('accept-success')
  await expect(alert).toBeVisible()
  await expect(alert).toBeFocused()
  await expect(alert).toContainText(`You accepted "${title}". It is now in My Tasks.`)

  await alert.getByRole('link', { name: 'View My Tasks' }).click()
  await expect(page).toHaveURL(/\/app\/tasks$/)
  await expect(card(page, title)).toBeVisible()
})
