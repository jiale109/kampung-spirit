import { test, expect } from '@playwright/test'
import { resetApp, login, uniqueTitle, chooseDay, choosePlace } from './helpers.js'

// Each test signs up its own adult and hosts sessions with unique titles, so the
// tests do not depend on what is already in Supabase.

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

// Find one session card by its title
function sessionCard(page, title) {
  return page.locator('.request-card', { hasText: title })
}

// Host a session through the form as the logged-in person. Ends on the list page.
async function hostSession(page, { title, category }) {
  await page.goto('/app/skill-swaps/new')
  await page.getByLabel('Name of your session').fill(title)
  await page.getByLabel('What will people learn?').fill('Come along and learn something new together.')
  await page.getByRole('button', { name: category, exact: true }).click()

  /*
    The venue is chosen on the map now, not typed: search OneMap, press the
    result, then name the place. stubOneMap (in resetApp) answers the search,
    so this does not call the live service.
  */
  await choosePlace(page, 'Eunos CC')
  await page.getByTestId('swap-venue').fill('Eunos CC, Level 2')

  // Tomorrow, so the time can never have passed already
  await chooseDay(page, 1)
  await page.getByRole('button', { name: 'Share my session' }).click()
  await expect(page).toHaveURL(/\/app\/skill-swaps(\?|$)/)
}

// These three categories used to be spelled differently from the database, so saving them failed
for (const category of ['Health & fitness', 'Arts & music', 'Other']) {
  test(`Adult can host a "${category}" session`, async ({ page }) => {
    const title = uniqueTitle(`${category} session`)

    await login(page, 'Adult', 'Mr Goh')
    await hostSession(page, { title, category })

    await page.goto('/app/skill-swaps')
    await expect(sessionCard(page, title)).toBeVisible()
  })
}
