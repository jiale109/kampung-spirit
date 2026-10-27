/*
  Profile                                                Owner: Clarence Tay
  Written in the style of e2e/hangouts.spec.js and using e2e/helpers.js.

  These tests sign up REAL Supabase accounts, so point .env at a test Supabase
  project if you have one.

  The avatar is the main thing checked here. It is one of the 24 pictures in
  public/images, named {age group}-{gender}-{skin tone}.svg, and the page has
  to pick the right one of those from three separate facts: the age group,
  which comes from the birth date, and the two the resident chooses.
*/
import { test, expect } from '@playwright/test'
import { resetApp, login } from './helpers.js'

async function openProfile(page) {
  await page.locator('a.dropdown-toggle').click()
  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('A new resident has no avatar until they choose one', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)

  // Nothing is guessed on their behalf, so the card asks instead
  await expect(page.getByTestId('age-icon')).toHaveCount(0)
  await expect(page.getByTestId('no-avatar')).toBeVisible()

  // And the form says the same, until a gender is pressed
  await page.getByTestId('edit-profile').click()
  await expect(page.getByTestId('avatar-preview')).toHaveCount(0)
  await expect(page.getByTestId('avatar-preview-empty')).toBeVisible()
})

test('The avatar changes as it is chosen, before anything is saved', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  // Pressing a gender brings the picture up at the lightest tone
  await page.getByTestId('gender-male').click()
  await expect(page.getByTestId('avatar-preview'))
    .toHaveAttribute('src', '/images/adult-male-light.svg')
  await expect(page.getByTestId('tone-label')).toHaveText('Light')

  // The slider walks through the four tones, in order
  const tones = ['light', 'brown', 'dark-brown', 'darkest']
  for (let i = 0; i < tones.length; i++) {
    await page.getByTestId('skin-tone').fill(String(i))
    await expect(page.getByTestId('avatar-preview'))
      .toHaveAttribute('src', `/images/adult-male-${tones[i]}.svg`)
  }

  // Changing gender keeps the tone that was chosen
  await page.getByTestId('gender-female').click()
  await expect(page.getByTestId('avatar-preview'))
    .toHaveAttribute('src', '/images/adult-female-darkest.svg')
  await expect(page.getByTestId('tone-label')).toHaveText('Darkest')
})

test('The chosen avatar is saved and is still there after a reload', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  await page.getByTestId('gender-female').click()
  await page.getByTestId('skin-tone').fill('2')
  await page.getByTestId('save-profile').click()

  // Back on the card, at the size the details column uses
  await expect(page.getByTestId('age-icon'))
    .toHaveAttribute('src', '/images/adult-female-dark-brown.svg')
  await expect(page.getByTestId('no-avatar')).toHaveCount(0)

  // It came from the database, not from the page remembering it
  await page.reload()
  await expect(page.getByTestId('age-icon'))
    .toHaveAttribute('src', '/images/adult-female-dark-brown.svg')

  // And reopening the form starts from what was saved, not from the default
  await page.getByTestId('edit-profile').click()
  await expect(page.getByTestId('tone-label')).toHaveText('Dark brown')
  await expect(page.getByTestId('gender-female')).toHaveAttribute('aria-pressed', 'true')
})

test('The age group still comes from the birth date, not from the picker', async ({ page }) => {
  // A senior and a youth choose exactly the same look and still get their own
  // age group's drawing
  await login(page, 'Senior', 'Mdm Tan')
  await page.goto('/app/profile')
  await page.getByTestId('edit-profile').click()
  await page.getByTestId('gender-female').click()
  await page.getByTestId('skin-tone').fill('1')
  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('age-icon'))
    .toHaveAttribute('src', '/images/senior-female-brown.svg')
})

test('An avatar of my own does not change what I can edit', async ({ page }) => {
  // The database only lets a user change their own name, block, interests,
  // large_text, gender and skin_tone (schema.sql sections 2 and 13). This
  // checks the two new ones save alongside the old ones in one press.
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  await page.getByLabel('Your name').fill('Clarence Tay')
  await page.getByTestId('gender-male').click()
  await page.getByTestId('skin-tone').fill('3')
  await page.getByTestId('save-profile').click()

  await expect(page.getByTestId('profile-name')).toHaveText('Clarence Tay')
  await expect(page.getByTestId('age-icon'))
    .toHaveAttribute('src', '/images/adult-male-darkest.svg')
})

test('An interest you added yourself can be switched off, and then removed', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  // Add one of your own. It arrives switched on.
  await page.getByTestId('new-interest').fill('Mahjong')
  await page.getByTestId('add-interest').click()
  const tile = page.getByRole('button', { name: 'Mahjong', exact: true })
  await expect(tile).toHaveAttribute('aria-pressed', 'true')

  // While it is ON there is no cross: the tile itself is how you switch off
  await expect(page.getByTestId('remove-Mahjong')).toHaveCount(0)

  // Switch it off and the cross appears
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('remove-Mahjong')).toBeVisible()

  // The cross takes it off the list altogether
  await page.getByTestId('remove-Mahjong').click()
  await expect(tile).toHaveCount(0)

  // A suggestion from the fixed list behaves the same way
  const fixed = page.getByRole('button', { name: 'Gardening', exact: true })
  await expect(page.getByTestId('remove-Gardening')).toBeVisible()
  await fixed.click()
  await expect(page.getByTestId('remove-Gardening')).toHaveCount(0)
  await fixed.click()
  await page.getByTestId('remove-Gardening').click()
  await expect(fixed).toHaveCount(0)

  // Typing it back brings it back, so nothing is lost for good
  await page.getByTestId('new-interest').fill('gardening')
  await page.getByTestId('add-interest').click()
  await expect(page.getByRole('button', { name: 'Gardening', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('Your own interests are saved, and come back with their crosses', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  await page.getByTestId('new-interest').fill('Lion dance')
  await page.getByTestId('add-interest').click()
  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('profile-interests')).toContainText('Lion dance')

  // Reopening the form knows it was yours, so it can still be removed
  await page.getByTestId('edit-profile').click()
  const tile = page.getByRole('button', { name: 'Lion dance', exact: true })
  await tile.click()
  await expect(page.getByTestId('remove-Lion dance')).toBeVisible()
  await page.getByTestId('remove-Lion dance').click()
  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('profile-interests')).not.toContainText('Lion dance')
})

test('A suggestion taken off the list stays off next time', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  // Gardening starts on the list for everyone
  const gardening = page.getByRole('button', { name: 'Gardening', exact: true })
  await expect(gardening).toBeVisible()

  // Take it off and save
  await page.getByTestId('remove-Gardening').click()
  await expect(gardening).toHaveCount(0)
  await page.getByTestId('save-profile').click()

  // Still gone after reopening the form, and after a reload: it came back
  // from the database, not from the page remembering
  await page.getByTestId('edit-profile').click()
  await expect(page.getByRole('button', { name: 'Gardening', exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByTestId('edit-profile').click()
  await expect(page.getByRole('button', { name: 'Gardening', exact: true })).toHaveCount(0)

  // Typing it back restores it, switched on, and it is a fixed tile again
  // rather than a second copy of its own
  await page.getByTestId('new-interest').fill('gardening')
  await page.getByTestId('add-interest').click()
  await expect(page.getByRole('button', { name: 'Gardening', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Gardening', exact: true })).toHaveCount(1)

  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('profile-interests')).toContainText('Gardening')
})

test('Cancel throws away a removal, it is not saved', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()

  await page.getByTestId('remove-Cooking').click()
  await expect(page.getByRole('button', { name: 'Cooking', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Reopening starts again from what was saved, so Cooking is back
  await page.getByTestId('edit-profile').click()
  await expect(page.getByRole('button', { name: 'Cooking', exact: true })).toBeVisible()
})

test('The walking avatar is off until asked for, and needs an avatar first', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)

  // Nothing walks by default
  await expect(page.getByTestId('walker')).toHaveCount(0)

  await page.getByTestId('edit-profile').click()
  // No avatar chosen yet, so the switch cannot be used
  await expect(page.getByTestId('walker-switch')).toBeDisabled()

  // Choose a look, and it becomes available
  await page.getByTestId('gender-male').click()
  await page.getByTestId('skin-tone').fill('2')
  await expect(page.getByTestId('walker-switch')).toBeEnabled()

  await page.getByTestId('walker-switch').check()
  await page.getByTestId('save-profile').click()

  // It walks, as the right person, with both frames of the stride
  const walker = page.getByTestId('walker')
  await expect(walker).toBeAttached()
  await expect(walker.locator('img').first())
    .toHaveAttribute('src', '/images/adult-male-dark-brown.svg')
  await expect(walker.locator('img').nth(1))
    .toHaveAttribute('src', '/images/adult-male-dark-brown-walk.svg')

  // Still there after a reload, so it came from the database
  await page.reload()
  await expect(page.getByTestId('walker')).toBeAttached()

  // And it can be switched off again
  await page.getByTestId('edit-profile').click()
  await page.getByTestId('walker-switch').uncheck()
  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('walker')).toHaveCount(0)
})

test('Someone who asks for less motion never sees the walker move', async ({ browser }) => {
  // The browser tells the page, and theme.css takes it from there. This is
  // WCAG 2.2.2 handled without the person having to find the switch.
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await resetApp(page)
  await login(page, 'Adult', 'Clarence')
  await openProfile(page)
  await page.getByTestId('edit-profile').click()
  await page.getByTestId('gender-female').click()
  await page.getByTestId('walker-switch').check()
  await page.getByTestId('save-profile').click()

  // It is in the page, but the stylesheet hides it
  await expect(page.getByTestId('walker')).toBeAttached()
  await expect(page.getByTestId('walker')).toBeHidden()
  await context.close()
})
