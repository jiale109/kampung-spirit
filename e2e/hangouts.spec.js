/*
  Hotspot hangouts                                       Owner: Clarence Tay
  Written in the style of e2e/helpboard.spec.js and using e2e/helpers.js.

  These tests sign up REAL Supabase accounts and leave real hangouts behind,
  so point .env at a test Supabase project if you have one. Every title has
  a timestamp in it so repeated runs never collide.

  Both outside APIs are replaced with page.route(): OneMap, because the form
  searches it for every hangout, and data.gov.sg for the rain warning. The
  tests are then fast, they spend none of the APIs' free quota, and they pass
  whether those services are up or not.
*/
import { test, expect } from '@playwright/test'
import { resetApp, login, logout, card, openCard } from './helpers.js'

// A different title each run, so old rows in the shared project cannot match
const stamp = () => Date.now().toString().slice(-6)

/*
  The day is chosen from the calendar in components/DayPicker.vue, so it is
  PRESSED rather than typed. 0 is today, 1 is tomorrow, and so on.
*/
function dayFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/*
  Press that day on the calendar. A day a week or two out can fall in the
  month after the one showing, so step forward once if it is not there yet.
*/
async function chooseDay(page, n) {
  const iso = dayFromToday(n)
  let cell = page.getByTestId(`day-${iso}`)
  if ((await cell.count()) === 0) {
    await page.getByTestId('next-month').click()
    cell = page.getByTestId(`day-${iso}`)
  }
  await cell.click()
  await expect(page.getByTestId('chosen-day')).toBeVisible()
}

// OneMap's reply, cut down to what lib/onemap.js reads
function onemapResult(name, lat, lng) {
  return {
    found: 1,
    results: [{
      SEARCHVAL: name,
      ADDRESS: name,
      POSTAL: 'NIL',
      LATITUDE: String(lat),
      LONGITUDE: String(lng),
    }],
  }
}

async function fakeOneMap(page, name, lat = 1.3326, lng = 103.9152) {
  await page.route('**/elastic/search*', (route) =>
    route.fulfill({ json: onemapResult(name, lat, lng) }),
  )
}

// Nothing found, which is what a search outside Singapore gives back
async function fakeOneMapEmpty(page) {
  await page.route('**/elastic/search*', (route) =>
    route.fulfill({ json: { found: 0, results: [] } }),
  )
}

/*
  data.gov.sg's reply, cut down to what lib/weather.js reads. area_metadata
  matters: a hangout can be anywhere, so lib/weather.js picks whichever
  forecast area is NEAREST to it. One area here means every hangout matches,
  whatever its coordinates.
*/
function forecast(area, text, lat = 1.33, lng = 103.91) {
  return {
    data: {
      area_metadata: [{ name: area, label_location: { latitude: lat, longitude: lng } }],
      items: [{ forecasts: [{ area, forecast: text }] }],
    },
  }
}

async function fakeWeather(page, area, text) {
  await page.route('**/two-hr-forecast*', (route) =>
    route.fulfill({ json: forecast(area, text) }),
  )
}

/*
  Fill in and submit the form. There is one box for the place: search OneMap
  and press what it finds. dayIndex 0 is today, 1 is tomorrow. time is an
  'HH:MM' slot; left out, the form keeps its default.
*/
async function proposeHangout(page, { title, place = 'Eunos Community Club', description, dayIndex = 1, time, outdoor }) {
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()
  await page.getByLabel('Short name').fill(title)

  await page.getByTestId('place-search').fill(place)
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
  // A search fills the name in; the host can still change it
  await expect(page.getByTestId('chosen-place')).toHaveValue(place)

  await page.getByLabel('What will you do?').fill(description)
  if (outdoor !== undefined) await page.getByTestId('outdoor-switch').setChecked(outdoor)
  await chooseDay(page, dayIndex)
  if (time) await page.getByLabel('What time?').selectOption(time)
  await page.getByRole('button', { name: 'Propose hangout' }).click()
}

/*
  The rain warning only covers the next 2 hours (FORECAST_HOURS in
  lib/weather.js). The form offers 08:00 to 20:00 in half hours, so find the
  first slot today that has not started and is within 2 hours. Returns null
  late at night or early in the morning, when no slot fits.
*/
function slotWithinForecast() {
  const now = new Date()
  const latest = now.getTime() + 2 * 60 * 60 * 1000
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) continue
      const slot = new Date(now)
      slot.setHours(h, m, 0, 0)
      // A minute's margin so the slot has not passed by the time the form is sent
      if (slot.getTime() > now.getTime() + 60 * 1000 && slot.getTime() <= latest) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }
  }
  return null
}

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('A resident can propose a hangout at a place found on OneMap', async ({ page }) => {
  await fakeOneMap(page, 'Bedok Public Library', 1.3244, 103.9301)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  // Validation: an empty form is rejected before anything is sent
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()
  await page.getByRole('button', { name: 'Propose hangout' }).click()
  await expect(page.getByText('Please write at least 5 characters.')).toBeVisible()
  await expect(page.getByText(/Please choose where to meet/)).toBeVisible()

  // Now a real one
  const title = `Library meet ${stamp()}`
  await page.getByLabel('Short name').fill(title)
  await page.getByTestId('place-search').fill('bedok public library')
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
  await page.getByLabel('What will you do?').fill('A quiet read and a chat at the library.')
  await chooseDay(page, 1)
  await page.getByRole('button', { name: 'Propose hangout' }).click()

  await expect(card(page, title)).toBeVisible()
  // The place OneMap gave back is on the card
  await expect(card(page, title)).toContainText('Bedok Public Library')
  // The host counts as going without joining
  await expect(card(page, title).getByText('You are hosting')).toBeVisible()
})

test('A neighbour can say they are coming, and change their mind', async ({ page }) => {
  const title = `Herb garden ${stamp()}`

  await fakeOneMap(page, 'Eunos Community Garden', 1.3215, 103.9065)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await proposeHangout(page, { title, place: 'Eunos Community Garden', description: 'Watering and weeding together.' })
  await expect(card(page, title)).toBeVisible()
  await logout(page)

  await fakeOneMap(page, 'Eunos Community Garden', 1.3215, 103.9065)
  await login(page, 'Youth', 'Wei Jie')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await (await openCard(page, title)).getByTestId('join').click()
  await expect(page.getByText(/You are going to/)).toBeVisible()
  await expect(card(page, title).getByText('You are going')).toBeVisible()
  await expect(card(page, title).getByTestId('going-text')).toHaveText('2 people going')

  await (await openCard(page, title)).getByTestId('leave').click()
  await expect(card(page, title).getByText('Open to join')).toBeVisible()
  await expect(card(page, title).getByTestId('going-text')).toHaveText('1 person going')
})

test('An outdoor hangout starting soon warns about rain, an indoor one does not', async ({ page }) => {
  const time = slotWithinForecast()
  test.skip(!time, 'No hangout time today is within the 2-hour forecast window')

  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await fakeWeather(page, 'Geylang', 'Thundery Showers')
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const outdoor = `Park walk ${stamp()}`
  await proposeHangout(page, {
    title: outdoor, place: 'Eunos Link Park',
    description: 'A gentle walk around the park.',
    dayIndex: 0, time, outdoor: true,
  })
  await (await openCard(page, outdoor))
  await expect(card(page, outdoor).getByTestId('weather-warning')).toContainText('Bring an umbrella')

  const indoor = `Indoor kopi ${stamp()}`
  await proposeHangout(page, {
    title: indoor, place: 'Eunos Link Park',
    description: 'Kopi and a chat indoors, rain or shine.',
    dayIndex: 0, time, outdoor: false,
  })
  await (await openCard(page, indoor))
  await expect(card(page, indoor).getByTestId('weather-warning')).toHaveCount(0)
})

test('An outdoor hangout further away than the forecast gets no warning', async ({ page }) => {
  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await fakeWeather(page, 'Geylang', 'Thundery Showers')
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const title = `Park walk tomorrow ${stamp()}`
  await proposeHangout(page, {
    title, place: 'Eunos Link Park',
    description: 'A walk tomorrow, well past the 2-hour forecast.',
    dayIndex: 1, outdoor: true,
  })
  await (await openCard(page, title))
  await expect(card(page, title).getByTestId('weather-warning')).toHaveCount(0)
})

test('The weather API being down does not break the page', async ({ page }) => {
  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await page.route('**/two-hr-forecast*', (route) => route.abort())

  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const title = `Rainy day test ${stamp()}`
  await proposeHangout(page, {
    title, place: 'Eunos Link Park',
    description: 'This one must show even with no forecast.',
    outdoor: true,
  })

  await expect(card(page, title)).toBeVisible()
  await expect(card(page, title).getByTestId('weather-warning')).toHaveCount(0)
})

test('Searching for a place filters the list to near it', async ({ page }) => {
  const atPark = `Park filter ${stamp()}`

  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await proposeHangout(page, {
    title: atPark, place: 'Eunos Link Park',
    description: 'Only this one is at the park for this run.',
  })
  await expect(card(page, atPark)).toBeVisible()

  /*
    The search box above the map is the typed way in, so it works with a
    keyboard. Pressing what it finds drops a pin there and shows the hangouts
    near it, so our park hangout stays on the list.
  */
  await page.getByTestId('place-search').fill('eunos link park')
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
  await expect(card(page, atPark)).toBeVisible()

  // And the filter can be taken off again
  await page.getByTestId('clear-filter').click()
  await expect(page.getByTestId('clear-filter')).toHaveCount(0)
  await expect(card(page, atPark)).toBeVisible()
})

test('A search that finds nothing cannot be saved', async ({ page }) => {
  // OneMap only indexes Singapore, so a foreign search simply finds nothing
  await fakeOneMapEmpty(page)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  await page.getByTestId('place-search').fill('eiffel tower paris')
  await page.getByTestId('place-search-go').click()
  await expect(page.getByText('No places found.')).toBeVisible()

  // With nowhere chosen the form refuses to send
  await page.getByLabel('Short name').fill(`Nowhere ${stamp()}`)
  await page.getByLabel('What will you do?').fill('This should never be saved anywhere.')
  await page.getByRole('button', { name: 'Propose hangout' }).click()
  await expect(page.getByText(/Please choose where to meet/)).toBeVisible()
})

test('A spot can be tapped straight onto the map and named', async ({ page }) => {
  // Nothing is searched for here: the point is choosing a place OneMap cannot
  // name, like a particular void deck.
  await fakeOneMapEmpty(page)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  const title = `Void deck chat ${stamp()}`
  await page.getByLabel('Short name').fill(title)

  // Tap the middle of the map
  await page.getByTestId('hotspot-map').click({ position: { x: 300, y: 200 } })

  // A tap gives no name, so the host writes one
  await expect(page.getByTestId('chosen-place')).toHaveValue('')
  await page.getByTestId('chosen-place').fill('Void deck of Blk 412')

  await page.getByLabel('What will you do?').fill('A sit down and a chat in the shade.')
  await chooseDay(page, 1)
  await page.getByRole('button', { name: 'Propose hangout' }).click()

  await expect(card(page, title)).toBeVisible()
  await expect(card(page, title)).toContainText('Void deck of Blk 412')
})

test('A pin with no name cannot be saved', async ({ page }) => {
  await fakeOneMapEmpty(page)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  await page.getByLabel('Short name').fill(`No name ${stamp()}`)
  await page.getByTestId('hotspot-map').click({ position: { x: 300, y: 200 } })
  await page.getByLabel('What will you do?').fill('This one has a pin but no name.')
  await page.getByRole('button', { name: 'Propose hangout' }).click()

  await expect(page.getByText(/Please give this place a name/)).toBeVisible()
})

test('Pressing a marker on the map filters the list to that place', async ({ page }) => {
  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  const title = `Map filter ${stamp()}`
  await proposeHangout(page, {
    title, place: 'Eunos Link Park',
    description: 'The one we will find by pressing the map.',
  })
  await expect(card(page, title)).toBeVisible()
  // No filter yet, so there is nothing to clear
  await expect(page.getByTestId('clear-filter')).toHaveCount(0)

  /*
    Markers are Leaflet circles, which it draws with the class
    leaflet-interactive. The shared Supabase project may hold other people's
    hangouts, so this presses whichever marker comes first and only checks
    that a filter went on and can be taken off again. The place name itself
    is covered by the search test above.
  */
  await page.getByTestId('hotspot-map').locator('.leaflet-interactive').first().click()
  await expect(page.getByTestId('clear-filter')).toBeVisible()

  await page.getByTestId('clear-filter').click()
  await expect(page.getByTestId('clear-filter')).toHaveCount(0)
  await expect(card(page, title)).toBeVisible()
})

test('A place with no hangouts says so and offers to propose one', async ({ page }) => {
  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()

  // Tap a corner of the map, far from anything that has a hangout
  await page.getByTestId('hotspot-map').click({ position: { x: 30, y: 30 } })

  await expect(page.getByText(/Sorry, there are no hangouts at/)).toBeVisible()
  await expect(page.getByTestId('propose-instead')).toBeVisible()

  // And it leads to the propose form
  await page.getByTestId('propose-instead').click()
  await expect(page.getByRole('heading', { name: 'Propose a hangout' })).toBeVisible()
})

test('A hangout can last up to three hours', async ({ page }) => {
  await fakeOneMap(page, 'Bishan Community Club', 1.3509, 103.8485)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  /*
    30 minutes to 3 hours in half hours. The same six lengths are in
    HANGOUT_DURATIONS in src/stores/hangout.js and in the check on the column
    in supabase/schema.sql section 12, so a length offered here is a length
    the database will take.
  */
  const lengths = await page.getByTestId('hangout-duration').locator('option')
    .evaluateAll((options) => options.map((o) => Number(o.value)))
  expect(lengths).toEqual([30, 60, 90, 120, 150, 180])

  // And the longest one really does save
  const title = `Long afternoon ${stamp()}`
  await page.getByLabel('Short name').fill(title)
  await page.getByTestId('place-search').fill('bishan community club')
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
  await page.getByLabel('What will you do?').fill('A long afternoon of board games together.')
  await chooseDay(page, 1)
  await page.getByTestId('hangout-duration').selectOption('180')
  await page.getByRole('button', { name: 'Propose hangout' }).click()

  await expect(card(page, title)).toBeVisible()
})

test('A warning goes away once that box is put right', async ({ page }) => {
  await fakeOneMap(page, 'Bishan Community Club', 1.3509, 103.8485)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  // An empty form complains about every box
  await page.getByRole('button', { name: 'Propose hangout' }).click()
  await expect(page.getByText(/Please choose where to meet/)).toBeVisible()
  await expect(page.getByText('Please write at least 5 characters.')).toBeVisible()

  // Choosing a place answers that warning, without pressing the button again
  await page.getByTestId('place-search').fill('bishan community club')
  await page.getByTestId('place-search-go').click()
  await page.getByTestId('place-results').getByRole('button').first().click()
  await expect(page.getByText(/Please choose where to meet/)).toHaveCount(0)

  // And so does typing a name
  await page.getByLabel('Short name').fill(`Fixed up ${stamp()}`)
  await expect(page.getByText('Please write at least 5 characters.')).toHaveCount(0)
})

test('The calendar shows a whole month and keeps to the two months we accept', async ({ page }) => {
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await page.getByRole('link', { name: 'Propose a hangout' }).first().click()

  // It opens on this month, and yesterday is not there to press
  const yesterday = dayFromToday(-1)
  await expect(page.getByTestId(`day-${yesterday}`)).toHaveCount(0)
  // There is no earlier month worth showing, so the back arrow is off
  await expect(page.getByTestId('previous-month')).toBeDisabled()

  // Today is there, and pressing it says so in words as well as in colour
  await page.getByTestId(`day-${dayFromToday(0)}`).click()
  await expect(page.getByTestId('chosen-day')).toContainText('You have chosen')

  // Next month is reachable, and going back returns to where we started
  const thisMonth = await page.getByTestId('month-label').textContent()
  await page.getByTestId('next-month').click()
  await expect(page.getByTestId('month-label')).not.toHaveText(thisMonth)
  await page.getByTestId('previous-month').click()
  await expect(page.getByTestId('month-label')).toHaveText(thisMonth)
})

test('Your own hangouts are listed apart from your neighbours\u2019', async ({ page }) => {
  const title = `Mine not theirs ${stamp()}`

  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await login(page, 'Adult', 'Clarence')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await proposeHangout(page, {
    title, place: 'Eunos Link Park',
    description: 'The host should find this one under their own heading.',
  })

  // The host sees it under "Hangouts you are hosting", and not under the other
  await expect(page.getByTestId('my-hangouts')).toContainText(title)
  await expect(page.getByTestId('my-hangouts')).toContainText('Hangouts you are hosting')
  await expect(page.getByTestId('neighbour-hangouts').filter({ hasText: title })).toHaveCount(0)
  await logout(page)

  // Somebody else sees the very same hangout under the neighbours' heading
  await fakeOneMap(page, 'Eunos Link Park', 1.3245, 103.9085)
  await login(page, 'Youth', 'Wei Jie')
  await page.getByRole('link', { name: 'Hangouts' }).click()
  await expect(page.getByTestId('neighbour-hangouts')).toContainText(title)
  await expect(page.getByTestId('my-hangouts').filter({ hasText: title })).toHaveCount(0)
})
