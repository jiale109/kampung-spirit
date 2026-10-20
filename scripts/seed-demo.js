/*
  Demo data for the Help Board                           Owner: Victoria Soh
  Run: pnpm seed:demo   (reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from .env)

  Signs up 3 demo seniors and 2 demo youths (the same details the sign-up page
  sends), then logs in as each senior and posts a few open requests.
  Safe to run again: accounts that already exist are skipped, and a senior who
  already has requests does not get more.
  Needs "Confirm email" switched off in Supabase (Authentication -> Email).
*/
import { createClient } from '@supabase/supabase-js'

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

async function main() {
  for (const youth of youths) {
    const { created } = await signUpOrLogIn(youth)
    console.log(`${created ? 'Created' : 'Skipped (already exists)'}: youth ${youth.name} <${youth.email}>`)
  }

  for (const senior of seniors) {
    const { client, created } = await signUpOrLogIn(senior)
    console.log(`${created ? 'Created' : 'Skipped (already exists)'}: senior ${senior.name} <${senior.email}>`)

    const { data: me } = await client.auth.getUser()
    const { count, error: countError } = await client
      .from('help_requests').select('id', { count: 'exact', head: true }).eq('requester_id', me.user.id)
    if (countError) throw new Error(`Could not check ${senior.name}'s requests: ${countError.message}`)

    if (count > 0) {
      console.log(`  ${senior.name} already has ${count} request(s), not adding more.`)
    } else {
      const rows = requestsBySenior[senior.email]
      const { error } = await client.from('help_requests').insert(rows)
      if (error) throw new Error(`Could not add ${senior.name}'s requests: ${error.message}`)
      console.log(`  Added ${rows.length} open requests.`)
    }
    await client.auth.signOut()
  }

  console.log(`\nDone. Every demo account uses the password: ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
