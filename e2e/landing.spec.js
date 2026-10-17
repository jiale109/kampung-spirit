import { test, expect } from '@playwright/test'
import { resetApp, login, logout, loginWith, fillSignUp, uniqueEmail, birthYearFor } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('The root path opens the login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/landing$/)
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('Signing up logs you in, and you can log out and back in', async ({ page }) => {
  await login(page, 'Senior', 'Mdm Tan Siew Lan')
  await expect(page.getByTestId('username')).toHaveText('Mdm Tan Siew Lan')
  await logout(page)

  // Same name again: logs in to the account made above
  await login(page, 'Senior', 'Mdm Tan Siew Lan')
  await expect(page.getByTestId('username')).toHaveText('Mdm Tan Siew Lan')
})

test('Seniors start on the senior pages, everyone else on the youth pages', async ({ page }) => {
  await login(page, 'Senior', 'Uncle Raj')
  await logout(page)
  await login(page, 'Youth', 'Wei Jie')
})

test('Logged-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/senior')
  await expect(page).toHaveURL(/\/landing$/)
  await page.goto('/youth/tasks')
  await expect(page).toHaveURL(/\/landing$/)
})

test('A wrong password shows a plain message', async ({ page }) => {
  await loginWith(page, uniqueEmail(), 'not-the-password')
  await expect(page.getByRole('alert')).toHaveText('That email or password is not right.')
  await expect(page).toHaveURL(/\/landing$/)
})

test('The sign-up form explains what is missing', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Please write your name.')).toBeVisible()
  await expect(page.getByText('Please choose your day, month and year of birth.')).toBeVisible()
  await expect(page).toHaveURL(/\/register$/)
})

test('Under 12s cannot sign up', async ({ page }) => {
  await fillSignUp(page, { name: 'Little Tom', email: uniqueEmail(), birthYear: new Date().getFullYear() - 8 })
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('You need to be at least 12 years old to join.')).toBeVisible()
  await expect(page).toHaveURL(/\/register$/)
})

test('Under 18s must give a parent or guardian and their consent', async ({ page }) => {
  await fillSignUp(page, { name: 'Aisha', email: uniqueEmail(), birthYear: birthYearFor.Minor })
  await expect(page.getByTestId('guardian-section')).toBeVisible()

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText("Please write your parent or guardian's name.")).toBeVisible()
  await expect(page.getByText('Your parent or guardian needs to agree before you can join.')).toBeVisible()

  await page.getByLabel("Parent or guardian's name").fill('Mdm Siti')
  await page.getByLabel("Parent or guardian's email").fill(uniqueEmail())
  await page.getByLabel(/agrees that I can join/).check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/youth$/)
})

test('Adults do not see the guardian section', async ({ page }) => {
  await fillSignUp(page, { name: 'Mr Tan', email: uniqueEmail(), birthYear: birthYearFor.Adult })
  await expect(page.getByTestId('guardian-section')).toBeHidden()
})
