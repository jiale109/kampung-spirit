import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('Request cards are simple until hovered, tapped or opened with the keyboard', async ({ page }) => {
  await login(page, 'Youth', 'Wei Jie')
  await page.mouse.move(0, 0) // the pointer is still where the Enter button was, which is now over a card
  const singpass = card(page, 'Singpass')
  const accept = singpass.getByTestId('accept')

  // Closed: the title shows, the details and buttons do not
  await expect(singpass.getByRole('button', { name: /Singpass/ })).toBeVisible()
  await expect(accept).toBeHidden()

  // Mouse over: details open. Mouse away: they close again
  await singpass.hover()
  await expect(accept).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(accept).toBeHidden()

  // Click or tap on the card: it stays open
  await singpass.getByRole('button', { name: /Singpass/ }).click()
  await page.mouse.move(0, 0)
  await expect(accept).toBeVisible()
  await expect(singpass.getByRole('button', { name: /Singpass/ })).toHaveAttribute('aria-expanded', 'true')

  // Keyboard: focus the title and press Enter to close it again
  await singpass.getByRole('button', { name: /Singpass/ }).focus()
  await page.keyboard.press('Enter')
  await expect(accept).toBeHidden()
})

test('A request waiting for the senior to confirm stays open', async ({ page }) => {
  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, 'Singpass')).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, 'Singpass')).getByTestId('mark-done').click()
  await logout(page)

  await login(page, 'Senior', 'Mdm Tan')
  await page.mouse.move(0, 0)
  await expect(card(page, 'Singpass').getByTestId('confirm')).toBeVisible()
})

test('Senior pages use larger text than youth pages', async ({ page }) => {
  const rootFontSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))

  await login(page, 'Senior', 'Mdm Tan')
  expect(await rootFontSize()).toBe(22)

  await logout(page)
  await login(page, 'Youth', 'Wei Jie')
  expect(await rootFontSize()).toBe(18)
})

for (const role of ['Senior', 'Youth']) {
  test(`${role} navbar fits the screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page, role, role === 'Senior' ? 'Mdm Tan' : 'Wei Jie')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(page.locator('a.dropdown-toggle')).toBeInViewport()
  })
}

// Placeholder pages that the team will build. Both roles can open all of them.
const pages = [
  { link: 'Hangouts', heading: 'Hangouts', path: 'hangouts' },
  { link: 'Skill Swaps', heading: 'Skill Swaps', path: 'skill-swaps' },
  { link: 'Rewards', heading: 'Rewards', path: 'rewards' },
]

for (const role of ['Senior', 'Youth']) {
  test(`${role} can open every page in the navbar`, async ({ page }) => {
    await login(page, role, role === 'Senior' ? 'Mdm Tan' : 'Wei Jie')
    const base = role.toLowerCase()

    for (const p of pages) {
      await page.getByRole('link', { name: p.link, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/${base}/${p.path}$`))
      await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible()
    }

    // Profile is in the name dropdown
    await page.locator('a.dropdown-toggle').click()
    await page.getByRole('link', { name: 'Profile' }).click()
    await expect(page).toHaveURL(new RegExp(`/${base}/profile$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
  })
}
