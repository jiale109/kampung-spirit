import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard, uniqueTitle, postRequest } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('Request cards open and close by click, tap or keyboard, not by hover', async ({ page }) => {
  const title = uniqueTitle('Singpass')
  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await page.mouse.move(0, 0) // the pointer is still where the Log in button was, which may now be over a card
  const singpass = card(page, title)
  const toggle = singpass.getByRole('button', { name: /Singpass/ })
  const accept = singpass.getByTestId('accept')

  // Closed: the title shows, the details and buttons do not
  await expect(toggle).toBeVisible()
  await expect(accept).toBeHidden()

  // Mouse over: the card stays closed and keeps its height
  const closedHeight = (await singpass.boundingBox()).height
  await singpass.hover()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(accept).toBeHidden()
  expect((await singpass.boundingBox()).height).toBe(closedHeight)

  // Click: it opens
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(accept).toBeVisible()

  // "Hide details" closes it, even though the mouse is still over the card
  const hint = await singpass.getByText('Hide details').boundingBox()
  await page.mouse.click(hint.x + hint.width / 2, hint.y + hint.height / 2)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(accept).toBeHidden()

  // Keyboard: Enter on the title opens it, and Enter again closes it
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(accept).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(accept).toBeHidden()
})

test('A request waiting for the senior to confirm stays open', async ({ page }) => {
  const title = uniqueTitle('Singpass')
  await login(page, 'Senior', 'Mdm Tan')
  await postRequest(page, { title })
  await logout(page)

  await login(page, 'Youth', 'Wei Jie')
  await (await openCard(page, title)).getByTestId('accept').click()
  await page.getByRole('link', { name: 'My Tasks' }).click()
  await (await openCard(page, title)).getByTestId('mark-done').click()
  await logout(page)

  await login(page, 'Senior', 'Mdm Tan')
  await page.mouse.move(0, 0)
  await expect(card(page, title).getByTestId('confirm')).toBeVisible()
})

test('Large text from the profile makes every page bigger, and is removed on log out', async ({ page }) => {
  const html = page.locator('html')
  const rootFontSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)

  // Sign up leaves large text off: 22px for everyone
  await login(page, 'Youth', 'Wei Jie')
  await expect(html).not.toHaveClass(/\blarge-text\b/)
  await expect.poll(rootFontSize).toBe('22px')

  // Turn it on from the profile page
  await page.goto('/app/profile')
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('Use large text').check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(html).toHaveClass(/\blarge-text\b/)
  await expect.poll(rootFontSize).toBe('27px')

  // Logging out takes it off again on the landing page
  await logout(page)
  await expect(html).not.toHaveClass(/\blarge-text\b/)
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
    // Both roles share one layout now, so every page is under /app
    const base = 'app'

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
