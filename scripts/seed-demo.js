
import { createClient } from '@supabase/supabase-js'
import { CATEGORIES, dateFromToday } from '../src/lib/skillSwapFormat.js'

try {
  process.loadEnvFile('.env')
} catch {
  console.error('No .env file found. Copy .env.example to .env and fill it in first.')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.')
  process.exit(1)
}

const DEMO_PASSWORD = 'kampung-demo-123'

// Youth birth years are worked out from today, so they stay 19-21
const thisYear = new Date().getFullYear()

const seniors = [
  { email: 'demo.tan@example.com', name: 'Mdm Tan Siew Lan', block: 'Blk 412 Eunos Cres', birthDate: '1950-03-12', largeText: true },
  { email: 'demo.lim@example.com', name: 'Mr Lim Ah Kow', block: 'Blk 410 Eunos Cres', birthDate: '1947-08-02', largeText: true },
  { email: 'demo.fatimah@example.com', name: 'Mdm Fatimah', block: 'Blk 415 Eunos Cres', birthDate: '1955-11-20', largeText: false },
]

const youths = [
  { email: 'demo.weijie@example.com', name: 'Wei Jie', block: 'Blk 405 Eunos Cres', birthDate: `${thisYear - 20}-01-15`, largeText: false },
  { email: 'demo.aisha@example.com', name: 'Aisha', block: 'Blk 418 Eunos Cres', birthDate: `${thisYear - 21}-01-09`, largeText: false },
]

// A time in the coming week: daysFromNow days ahead, at hour:00
function inDays(daysFromNow, hour) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

// Requests for each senior, by email. Together they cover all 5 categories.
const requestsBySenior = {
  'demo.tan@example.com': [
    { title: 'Help me set up Singpass', description: 'I got a new phone and cannot log in to Singpass any more.', category: 'Tech', difficulty: 'Medium', duration: 45, needed_at: inDays(1, 10) },
    { title: 'Buy groceries from Sheng Siong', description: 'Rice, eggs, vegetables and milk. I will give you the list and money.', category: 'Grocery', difficulty: 'Easy', duration: 30, needed_at: inDays(2, 9) },
    { title: 'Walk with me to the clinic', description: 'Polyclinic appointment at Eunos. I walk slowly and need company.', category: 'Companion Walk', difficulty: 'Easy', duration: 60, needed_at: inDays(4, 14) },
  ],
  'demo.lim@example.com': [
    { title: 'Carry gas tank upstairs', description: 'New gas tank arrives at the void deck, I cannot carry it up.', category: 'Lifting', difficulty: 'Hard', duration: 15, needed_at: inDays(1, 16) },
    { title: 'Explain my HDB letter in Chinese', description: 'I received an English letter from HDB and want to know what it says.', category: 'Translation', difficulty: 'Easy', duration: 15, needed_at: inDays(3, 11) },
  ],
  'demo.fatimah@example.com': [
    { title: 'Video call my grandson', description: 'Please show me how to video call on WhatsApp so I can see my grandson.', category: 'Tech', difficulty: 'Easy', duration: 30, needed_at: inDays(2, 15) },
    { title: 'Move my old cabinet', description: 'Small wooden cabinet from the bedroom to the living room.', category: 'Lifting', difficulty: 'Medium', duration: 30, needed_at: inDays(5, 10) },
    { title: 'Translate a clinic form to Malay', description: 'The polyclinic gave me a form in English. Please explain it in Malay.', category: 'Translation', difficulty: 'Easy', duration: 30, needed_at: inDays(6, 13) },
  ],
}

// Hangouts for each host, by email. Dates are 1 to 6 days ahead, because the
// database refuses hangouts in the past. Hotspot ids come from src/lib/hotspots.js.
const hangoutsByHost = {
  'demo.tan@example.com': [
    { title: 'Morning walk at the park', description: 'A gentle walk and a chat. We stop whenever anyone needs a rest.', hotspot_id: 'eunos-park', hangout_date: dateFromToday(1), hangout_time: '08:30', duration: 60 },
  ],
  'demo.fatimah@example.com': [
    { title: 'Herb garden morning', description: 'Watering and weeding together. Gloves provided.', hotspot_id: 'eunos-community-garden', hangout_date: dateFromToday(3), hangout_time: '09:00', duration: 90 },
  ],
  'demo.weijie@example.com': [
    { title: 'Board games at the CC', description: 'Chinese chess, Monopoly Deal and snacks. Beginners welcome.', hotspot_id: 'eunos-cc', hangout_date: dateFromToday(2), hangout_time: '19:00', duration: 120 },
  ],
  'demo.aisha@example.com': [
    { title: 'Kopi and newspapers', description: 'Read the papers together over kopi. Come and go as you like.', hotspot_id: 'eunos-crescent-market', hangout_date: dateFromToday(5), hangout_time: '10:00', duration: 60 },
  ],
}

// Skill sessions for each host, by email. Categories come from CATEGORIES in
// src/lib/skillSwapFormat.js (0 Tech, 1 Cooking, 2 Crafts, 5 Languages).
const sessionsByHost = {
  'demo.tan@example.com': [
    // Capacity 2, and two people join it below, so the demo has a full session
    { title: 'Crochet for beginners', description: 'Learn the basic stitches and make your first coaster. Wool and hooks are provided.', category: CATEGORIES[2], venue: 'Void deck, Blk 412 Eunos Cres', session_date: dateFromToday(4), session_time: '10:00', duration: 90, capacity: 2 },
  ],
  'demo.lim@example.com': [
    { title: 'Traditional kueh making', description: 'Make kueh dadar from a family recipe, then taste it together.', category: CATEGORIES[1], venue: 'Eunos CC kitchen', session_date: dateFromToday(6), session_time: '11:00', duration: 120, capacity: 6 },
  ],
  'demo.weijie@example.com': [
    { title: 'Staying safe with digital banking', description: 'Learn how to spot scam messages and use your banking app with confidence.', category: CATEGORIES[0], venue: 'Eunos CC, Level 2', session_date: dateFromToday(3), session_time: '15:00', duration: 60, capacity: 8 },
  ],
  'demo.aisha@example.com': [
    { title: 'Basic Malay for neighbours', description: 'Greetings and everyday phrases for the market and the coffee shop.', category: CATEGORIES[5], venue: 'Eunos CC, Level 1', session_date: dateFromToday(2), session_time: '16:30', duration: 60, capacity: 10 },
  ],
}

// Who joins what (found by host and title, so it also works on a second run)
const hangoutJoins = [
  { email: 'demo.lim@example.com', host: 'demo.tan@example.com', title: 'Morning walk at the park' },
  { email: 'demo.weijie@example.com', host: 'demo.tan@example.com', title: 'Morning walk at the park' },
  { email: 'demo.tan@example.com', host: 'demo.weijie@example.com', title: 'Board games at the CC' },
]
const sessionJoins = [
  { email: 'demo.fatimah@example.com', host: 'demo.tan@example.com', title: 'Crochet for beginners' },
  { email: 'demo.aisha@example.com', host: 'demo.tan@example.com', title: 'Crochet for beginners' },
]

// One client per person, so each one is logged in separately
function newClient() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Sign up (with the same metadata as stores/auth.js register()), or log in if the account exists.
// Returns { client, created } or throws with a plain message.
async function signUpOrLogIn(person) {
  const client = newClient()
  const { data, error } = await client.auth.signUp({
    email: person.email,
    password: DEMO_PASSWORD,
    options: {
      data: {
        name: person.name,
        block: person.block,
        birth_date: person.birthDate,
        large_text: person.largeText,
        guardian_name: null,
        guardian_email: null,
        guardian_consent: false,
      },
    },
  })

  if (!error && data.session) return { client, created: true }
  if (!error && !data.session) throw new Error('No session after sign up. Switch off "Confirm email" in Supabase.')
  if (error.code !== 'user_already_exists') throw new Error(`Could not sign up ${person.email}: ${error.message}`)

  const login = await client.auth.signInWithPassword({ email: person.email, password: DEMO_PASSWORD })
  if (login.error) throw new Error(`${person.email} already exists but the demo password did not work: ${login.error.message}`)
  return { client, created: false }
}

// Add a host's hangouts or sessions, unless they already have open ones from today on
async function addAsHost(person, { table, dateColumn, rows, label }) {
  if (!rows) return
  const { client, id, name } = person
  const { count, error: countError } = await client
    .from(table).select('id', { count: 'exact', head: true })
    .eq('host_id', id).eq('status', 'open').gte(dateColumn, dateFromToday(0))
  if (countError) throw new Error(`Could not check ${name}'s ${label}: ${countError.message}`)

  if (count > 0) {
    console.log(`  ${name} already has ${count} open ${label}, not adding more.`)
    return
  }
  const { error } = await client.from(table).insert(rows)
  if (error) throw new Error(`Could not add ${name}'s ${label}: ${error.message}`)
  console.log(`  ${name}: added ${rows.length} ${label}.`)
}

// Join a hangout or session. "Already going" / "already have a place" is fine on a second run.
async function join(person, host, { table, dateColumn, title, rpc, idArg, label }) {
  const { data: found, error: findError } = await person.client
    .from(table).select('id')
    .eq('host_id', host.id).eq('title', title).eq('status', 'open').gte(dateColumn, dateFromToday(0))
    .limit(1)
  if (findError) throw new Error(`Could not find ${label} "${title}": ${findError.message}`)
  if (!found.length) {
    console.log(`  Skipped: ${person.name} joining "${title}" (not found)`)
    return
  }

  const { error } = await person.client.rpc(rpc, { [idArg]: found[0].id })
  if (error && /already/i.test(error.message)) {
    console.log(`  Skipped: ${person.name} is already in "${title}"`)
  } else if (error) {
    throw new Error(`${person.name} could not join "${title}": ${error.message}`)
  } else {
    console.log(`  ${person.name} joined ${label} "${title}".`)
  }
}

async function main() {
  // 1. Every account first, so hosts and joins can use any of them
  const people = {}
  for (const [group, list] of [['youth', youths], ['senior', seniors]]) {
    for (const person of list) {
      const { client, created } = await signUpOrLogIn(person)
      const { data: me } = await client.auth.getUser()
      people[person.email] = { client, id: me.user.id, name: person.name }
      console.log(`${created ? 'Created' : 'Skipped (already exists)'}: ${group} ${person.name} <${person.email}>`)
    }
  }

  // 2. Help requests
  console.log('\nHelp requests')
  for (const senior of seniors) {
    const { client, id } = people[senior.email]
    const { count, error: countError } = await client
      .from('help_requests').select('id', { count: 'exact', head: true }).eq('requester_id', id)
    if (countError) throw new Error(`Could not check ${senior.name}'s requests: ${countError.message}`)

    if (count > 0) {
      console.log(`  ${senior.name} already has ${count} request(s), not adding more.`)
    } else {
      const rows = requestsBySenior[senior.email]
      const { error } = await client.from('help_requests').insert(rows)
      if (error) throw new Error(`Could not add ${senior.name}'s requests: ${error.message}`)
      console.log(`  ${senior.name}: added ${rows.length} open requests.`)
    }
  }

  // 3. Hangouts and skill sessions, inserted by each host
  console.log('\nHangouts')
  for (const [email, rows] of Object.entries(hangoutsByHost)) {
    await addAsHost(people[email], { table: 'hangouts', dateColumn: 'hangout_date', rows, label: 'hangout(s)' })
  }
  console.log('\nSkill swaps')
  for (const [email, rows] of Object.entries(sessionsByHost)) {
    await addAsHost(people[email], { table: 'skill_sessions', dateColumn: 'session_date', rows, label: 'skill session(s)' })
  }

  // 4. Joins (they need the ids from step 3)
  console.log('\nJoins')
  for (const j of hangoutJoins) {
    await join(people[j.email], people[j.host], {
      table: 'hangouts', dateColumn: 'hangout_date', title: j.title, rpc: 'join_hangout', idArg: 'hangout_id', label: 'hangout',
    })
  }
  for (const j of sessionJoins) {
    await join(people[j.email], people[j.host], {
      table: 'skill_sessions', dateColumn: 'session_date', title: j.title, rpc: 'join_skill_session', idArg: 'swap_id', label: 'skill swap',
    })
  }

  for (const person of Object.values(people)) await person.client.auth.signOut()

  console.log(`\nDone. Every demo account uses the password: ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
