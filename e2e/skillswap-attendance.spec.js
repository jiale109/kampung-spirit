import { test, expect } from '@playwright/test'
import { resetApp, forgetAccounts, login, switchTo, uniqueTitle, dayFromToday } from './helpers.js'

/*
  The host's "Who came?" page (SkillSwapAttendanceView.vue).

  The accounts are real, but the session is not. A session has to be booked
  at least 24 hours ahead (skill_sessions_check() in schema.sql), and the host
  can only say who came once it has started, so a test can never make a real
  one that is ready. Instead the list of sessions is answered here with one
  that started yesterday, hosted by the account that is logged in, and the
  complete_skill_session call is caught so we can see exactly who would be
  paid.

  What the database then does with that list (points only for the ids sent,
  refusing an empty list or someone who did not sign up) is in
  complete_skill_session(); see the SQL notes in
  supabase/migrations/20261108120000_skill_swap_attendance.sql.
*/

const HOST = 'Mr Goh'
const OTHER = 'Ms Lim'

// Two people with a place. Ids only need to look like uuids: nobody logs in as them.
const SITI = { id: '00000000-0000-4000-8000-000000000001', name: 'Siti' }
const RAJ = { id: '00000000-0000-4000-8000-000000000002', name: 'Raj' }

test.beforeAll(forgetAccounts)
test.beforeEach(async ({ page }) => { await resetApp(page, { keepAccounts: true }) })

// The logged-in person's id, from the session supabase-js keeps in localStorage
async function myId(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    return JSON.parse(localStorage.getItem(key)).user.id
  })
}

/*
  Answer every load of skill_sessions with one session that started yesterday
  at 10 am (60 minutes = 30 points). Returns what the page sent to
  complete_skill_session, so the test can check who would be paid.
*/
async function fakeStartedSession(page, { title, hostId }) {
  const session = {
    id: '00000000-0000-4000-8000-0000000000aa',
    title,
    description: 'Learn to video call your family.',
    category: 'Tech',
    venue: 'Eunos CC, Level 2',
    latitude: 1.32964,
    longitude: 103.90538,
    session_date: dayFromToday(-1),
    session_time: '10:00:00',
    duration: 60,
    capacity: 5,
    status: 'open',
    host_id: hostId,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    host: { name: HOST },
    attendees: [SITI, RAJ].map((p) => ({ user_id: p.id, attended: null, user: { name: p.name } })),
  }
  const calls = []
  await page.route('**/rest/v1/skill_sessions*', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ json: session.status === 'open' ? [session] : [] })
  })
  await page.route('**/rest/v1/rpc/complete_skill_session*', (route) => {
    calls.push(route.request().postDataJSON())
    session.status = 'completed'
    return route.fulfill({ status: 204, body: '' })
  })
  return { session, calls }
}

test('Host ticks 1 of 2 people: only that person is sent to be paid', async ({ page }) => {
  const title = uniqueTitle('Video calls for beginners')
  await login(page, 'Adult', HOST)
  const { session, calls } = await fakeStartedSession(page, { title, hostId: await myId(page) })

  // "Mark as completed" on the card now opens the attendance page
  await page.goto('/app/skill-swaps')
  const card = page.locator('.request-card', { hasText: title })
  await card.locator('.request-toggle').click()
  await card.getByTestId('mark-completed').click()
  await expect(page).toHaveURL(new RegExp(`/app/skill-swaps/${session.id}/attendance$`))

  await expect(page.getByRole('heading', { name: `Who came to ${title}?` })).toBeVisible()
  const siti = page.getByRole('checkbox', { name: SITI.name })
  const raj = page.getByRole('checkbox', { name: RAJ.name })
  const count = page.getByTestId('attendance-count')

  // Nobody is ticked to begin with
  await expect(siti).not.toBeChecked()
  await expect(raj).not.toBeChecked()
  await expect(count).toHaveText('0 of 2 came')

  // "Select all" ticks everyone; tapping the row (not just the box) unticks one
  await page.getByRole('button', { name: 'Select all' }).click()
  await expect(count).toHaveText('2 of 2 came')
  await page.getByTestId('attendee-row').filter({ hasText: RAJ.name }).click()
  await expect(raj).not.toBeChecked()
  await expect(siti).toBeChecked()
  await expect(count).toHaveText('1 of 2 came')

  // The modal says what will happen; "Go back" changes nothing
  await page.getByRole('button', { name: 'Confirm and give points' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('1 person will get 30 points. This cannot be undone.')
  await dialog.getByRole('button', { name: 'Go back' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls).toHaveLength(0)

  await page.getByRole('button', { name: 'Confirm and give points' }).click()
  await page.getByTestId('confirm-attendance').click()

  // Only Siti is sent, so only Siti's points go up; Raj gets none
  await expect(page).toHaveURL(/\/app\/skill-swaps\?/)
  expect(calls).toEqual([{ swap_id: session.id, attended_ids: [SITI.id] }])
  const notice = page.getByTestId('swap-notice')
  await expect(notice).toHaveText('Done! 1 person earned 30 points.')
  await expect(notice).toBeFocused()
  await expect(page.locator('.request-card', { hasText: title })).toHaveCount(0)
})

test('Confirm is blocked while nobody is ticked', async ({ page }) => {
  const title = uniqueTitle('Phone photos made easy')
  await login(page, 'Adult', HOST)
  const { session, calls } = await fakeStartedSession(page, { title, hostId: await myId(page) })

  await page.goto(`/app/skill-swaps/${session.id}/attendance`)
  await expect(page.getByTestId('attendance-count')).toHaveText('0 of 2 came')
  await page.getByRole('button', { name: 'Confirm and give points' }).click()

  const error = page.getByRole('alert')
  await expect(error).toHaveText('Please tick at least one person who came.')
  await expect(error).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls).toHaveLength(0)
  await expect(page).toHaveURL(/\/attendance$/)

  // Ticking someone clears the message, and then the modal opens
  await page.getByRole('checkbox', { name: RAJ.name }).check()
  await expect(error).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm and give points' }).click()
  await expect(page.getByRole('dialog')).toContainText('1 person will get 30 points.')
})

test('Someone who is not the host cannot use the page', async ({ page }) => {
  const title = uniqueTitle('Knitting for starters')
  await login(page, 'Adult', HOST)
  const hostId = await myId(page)
  await switchTo(page, 'Adult', OTHER)
  const { session, calls } = await fakeStartedSession(page, { title, hostId })

  await page.goto(`/app/skill-swaps/${session.id}/attendance`)
  await expect(page.getByText('Only the host can say who came to this session.')).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirm and give points' })).toHaveCount(0)
  expect(calls).toHaveLength(0)

  await page.getByTestId('back-to-swaps').click()
  await expect(page).toHaveURL(/\/app\/skill-swaps$/)
})
