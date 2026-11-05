import { test, expect } from '@playwright/test'
import { resetApp, login, uniqueTitle, chooseDay, choosePlace, switchTo } from './helpers.js'

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

  // The day after tomorrow: sessions need 24 hours' notice, and tomorrow at the
  // form's default 3:00 PM is less than that once it is past 3 PM today
  await chooseDay(page, 2)
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

// Test that another user can successfully join an existing session
test('Adult can join an existing SkillSwap session', async ({ page }) => {
  const title = uniqueTitle('Join test session')

  // Step 1: Log in as host
  await login(page, 'Adult', 'Mr Goh')

  // Step 2: Host a new session
  await hostSession(page, {
    title,
    category: 'Health & fitness'
  })

  // Step 3: Switch to another adult account
  await switchTo(page, 'Adult', 'Ms Lim')

  // Step 4: Navigate to SkillSwap 
  await page.goto('/app/skill-swaps')

  // Step 5: Find the session created by Mr Goh
  const card = sessionCard(page, title)
  await expect(card).toBeVisible()

  // Step 6: Open session details
  await card.getByRole('button', { name: title }).click()

  // Step 7: Join session
  await card.getByRole('button', {
    name: 'Join this session'
  }).click()

  // Step 8: Verify successful join
  await expect(
    page.getByText(`You have a place in “${title}”.`)
  ).toBeVisible()

  await expect(
    card.getByText('You are going')
  ).toBeVisible()
})

// Test that user can leave a session
test('Adult can leave an existing SkillSwap session', async ({ page }) => {
  const title = uniqueTitle('Leave test session')

  // Step 1: Log in as host
  await login(page, 'Adult', 'Mr Goh')

  // Step 2: Host new session
  await hostSession(page, {
    title,
    category: 'Health & fitness'
  })

  // Step 3: Switch to another adult account
  await switchTo(page, 'Adult', 'Ms Lim')

  // Step 4: Go to SkillSwap
  await page.goto('/app/skill-swaps')

  // Step 5: Find session
  const card = sessionCard(page, title)
  await expect(card).toBeVisible()

  // Step 6: Open session details
  await card.getByRole('button', { name: title }).click()

  // Step 7: Join session first
  await card.getByRole('button', {
    name: 'Join this session'
  }).click()

  // Step 8: Verify succesful join
  await expect(
    page.getByText(`You have a place in “${title}”.`)
  ).toBeVisible()

  // Step 9: Leave session
  await card.getByRole('button', {
    name: 'Cancel my place'
  }).click()

  // Step 10: Verify that attendance was cancelled
  await expect(
    page.getByText(`Your place in “${title}” is cancelled.`)
  ).toBeVisible()

  await expect(
    card.getByText('You are going')
  ).not.toBeVisible()
})