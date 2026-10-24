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
  await page.goto('/app/requests')
  await expect(page).toHaveURL(/\/landing$/)
  await page.goto('/app/tasks')
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
  await expect(page).toHaveURL(/\/app$/)
})

test('Adults do not see the guardian section', async ({ page }) => {
  await fillSignUp(page, { name: 'Mr Tan', email: uniqueEmail(), birthYear: birthYearFor.Adult })
  await expect(page.getByTestId('guardian-section')).toBeHidden()
})

test('The password must meet every rule, and the two passwords must match', async ({ page }) => {
  await fillSignUp(page, { name: 'Mr Tan', email: uniqueEmail(), birthYear: birthYearFor.Adult })
  const password = page.getByLabel('Password', { exact: true })
  const again = page.getByLabel('Type your password again')

  // Too weak: no capital letter, number or special character
  await password.fill('kampungs')
  await again.fill('kampungs')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Your password does not meet all the rules below yet.')).toBeVisible()
  await expect(page.getByTestId('password-rules').getByText('At least 8 characters')).toContainText('(done)')
  await expect(page.getByTestId('password-rules').getByText('A capital letter')).toContainText('(not yet)')

  // Strong, but the second box is different
  await password.fill('Kampung-test-123')
  await again.fill('Kampung-test-124')
  await expect(page.getByText('The passwords do not match yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('The two passwords are different. Please type them again.')).toBeVisible()
  await expect(page).toHaveURL(/\/register$/)
})

test('The eye button shows and hides each password', async ({ page }) => {
  await page.goto('/register')
  const password = page.getByLabel('Password', { exact: true })
  await password.fill('Kampung-test-123')
  await expect(password).toHaveAttribute('type', 'password')

  const toggles = page.getByRole('button', { name: 'Show password' })
  await expect(toggles).toHaveCount(2)
  await toggles.first().click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByLabel('Type your password again')).toHaveAttribute('type', 'password')

  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})
