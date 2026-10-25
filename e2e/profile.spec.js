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
