/*
  Hotspot hangouts                                       Owner: Clarence Tay
  Written in the style of e2e/helpboard.spec.js and using e2e/helpers.js.

  These tests sign up REAL Supabase accounts and leave real hangouts behind,
  so point .env at a test Supabase project if you have one. Every title has
  a timestamp in it so repeated runs never collide.

  The weather test replaces the data.gov.sg call with page.route(), so it
  passes whatever the real weather is doing and never depends on an outside
  API being up.
*/
import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard } from './helpers.js'

// A different title each run, so old rows in the shared project cannot match
const stamp = () => Date.now().toString().slice(-6)

// The shape data.gov.sg sends back, cut down to what lib/weather.js reads
function forecast(area, text) {
  return { data: { items: [{ forecasts: [{ area, forecast: text }] }] } }
}

async function fakeWeather(page, area, text) {
  await page.route('**/two-hr-forecast*', (route) =>
    route.fulfill({ json: forecast(area, text) }),
  )
}

// Fill in and submit the propose-a-hangout form
async function proposeHangout(page, { title, hotspotId = 'eunos-cc', description }) {
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()
  await page.getByLabel('Short name').fill(title)
  await page.getByLabel('Where shall we meet?').selectOption(hotspotId)
  await page.getByLabel('What will you do?').fill(description)
  await page.getByLabel('Which day?').selectOption({ index: 1 }) // tomorrow
  await page.getByRole('button', { name: 'Propose hangout' }).click()
}

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('A resident can propose a hangout', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  // Validation: an empty form is rejected before anything is sent
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()
  await page.getByRole('button', { name: 'Propose hangout' }).click()
  await expect(page.getByText('Please write at least 5 characters.')).toBeVisible()
  await expect(page.getByText('Please choose where to meet.')).toBeVisible()

  // Now a real one
  const title = `Morning kopi ${stamp()}`
  await page.getByLabel('Short name').fill(title)
  await page.getByLabel('Where shall we meet?').selectOption('eunos-cc')
  await page.getByLabel('What will you do?').fill('Kopi and a chat before the day starts.')
  await page.getByLabel('Which day?').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Propose hangout' }).click()

  await expect(card(page, title)).toBeVisible()
  // The host is counted as going, so the card says so without them joining
  await expect(card(page, title).getByText('You are hosting')).toBeVisible()
})

test('A neighbour can say they are coming, and change their mind', async ({ page }) => {
  const title = `Herb garden ${stamp()}`

  // The host proposes it
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await proposeHangout(page, { title, description: 'Watering and weeding together.' })
  await expect(card(page, title)).toBeVisible()
  await logout(page)

  // Somebody else joins
  await login(page, 'Youth', 'Wei Jie')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await (await openCard(page, title)).getByTestId('join').click()
  await expect(page.getByText(/You are going to/)).toBeVisible()
  await expect(card(page, title).getByText('You are going')).toBeVisible()
  await expect(card(page, title).getByTestId('going-text')).toHaveText('2 people going')

  // And can drop out again
  await (await openCard(page, title)).getByTestId('leave').click()
  await expect(card(page, title).getByText('Open to join')).toBeVisible()
  await expect(card(page, title).getByTestId('going-text')).toHaveText('1 person going')
})

test('An outdoor hangout warns about rain, an indoor one does not', async ({ page }) => {
  // Geylang is the forecast area for the garden and the park in lib/hotspots.js
  await fakeWeather(page, 'Geylang', 'Thundery Showers')

  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const outdoor = `Park walk ${stamp()}`
  await proposeHangout(page, {
    title: outdoor,
    hotspotId: 'eunos-park', // outdoor: true
    description: 'A gentle walk around the park.',
  })
  await (await openCard(page, outdoor))
  await expect(card(page, outdoor).getByTestId('weather-warning')).toContainText('Bring an umbrella')

  const indoor = `Indoor kopi ${stamp()}`
  await proposeHangout(page, {
    title: indoor,
    hotspotId: 'eunos-cc', // outdoor: false
    description: 'Kopi and a chat indoors, rain or shine.',
  })
  await (await openCard(page, indoor))
  await expect(card(page, indoor).getByTestId('weather-warning')).toHaveCount(0)
})

test('The weather API being down does not break the page', async ({ page }) => {
  // Every hangout must still be visible and joinable with no forecast at all
  await page.route('**/two-hr-forecast*', (route) => route.abort())

  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const title = `Rainy day test ${stamp()}`
  await proposeHangout(page, {
    title,
    hotspotId: 'eunos-park',
    description: 'This one must show even with no forecast.',
  })

  await expect(card(page, title)).toBeVisible()
  await expect(card(page, title).getByTestId('weather-warning')).toHaveCount(0)
})

test('Hangouts can be filtered by place', async ({ page }) => {
  const atPark = `Park filter ${stamp()}`

  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await proposeHangout(page, {
    title: atPark,
    hotspotId: 'eunos-park',
    description: 'Only this one is at the park for this run.',
  })

  await page.getByTestId('hotspot-filter').selectOption('eunos-park')
  await expect(card(page, atPark)).toBeVisible()

  // Switching to another place hides it
  await page.getByTestId('hotspot-filter').selectOption('eunos-mrt')
  await expect(card(page, atPark)).toHaveCount(0)
})
