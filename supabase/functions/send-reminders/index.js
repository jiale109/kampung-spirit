// send-reminders: run every hour by a Supabase Cron job. Sends ONE reminder to
// everyone going (host included) about a day before each skill swap and hangout.
//
// It looks for open sessions and hangouts that start within the next 24 hours
// and have no reminder yet, messages the people going, then sets
// reminder_sent_at so the next run skips them. Something made less than a day
// ahead gets its reminder on the next hourly run.
//
// Deploy with:  supabase functions deploy send-reminders   (JWT checking is off in supabase/config.toml)
// The cron job must send the header  x-notify-secret: <NOTIFY_SECRET>.
//
// Secrets: TELEGRAM_BOT_TOKEN, NOTIFY_SECRET (optional: APP_URL)

import { adminClient, formatWhen, isTrustedCaller, notifyUsers, openApp, singaporeMoment } from '../_shared/telegram.js'

const DAY_MS = 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  if (!isTrustedCaller(req)) return new Response('Forbidden', { status: 403 })

  const db = adminClient()
  const now = new Date()
  const until = new Date(now.getTime() + DAY_MS)

  // Today and tomorrow in Singapore, to narrow the search before checking exact times
  const sgDate = (d) => new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const fromDate = sgDate(now)
  const toDate = sgDate(until)

  const startsSoon = (date, time) => {
    const start = singaporeMoment(date, time)
    return start > now && start <= until
  }

  let sent = 0

  // ---- Skill swaps ----
  const { data: sessions, error: sessionsError } = await db
    .from('skill_sessions')
    .select('id, title, venue, session_date, session_time, host_id')
    .eq('status', 'open')
    .is('reminder_sent_at', null)
    .gte('session_date', fromDate)
    .lte('session_date', toDate)
  if (sessionsError) console.error('Could not read skill_sessions', sessionsError.message)

  for (const s of (sessions ?? []).filter((s) => startsSoon(s.session_date, s.session_time))) {
    const { data: people } = await db.from('skill_session_attendees').select('user_id').eq('session_id', s.id)
    sent += await notifyUsers(db, [s.host_id, ...(people ?? []).map((p) => p.user_id)],
      `Reminder: the skill swap "${s.title}" is on ${formatWhen(s.session_date, s.session_time)} at ${s.venue}.\n\n${openApp('/app/skill-swaps')}`)
    await db.from('skill_sessions').update({ reminder_sent_at: now.toISOString() }).eq('id', s.id)
  }

  // ---- Hangouts ----
  const { data: hangouts, error: hangoutsError } = await db
    .from('hangouts')
    .select('id, title, place_name, hangout_date, hangout_time')
    .eq('status', 'open')
    .is('reminder_sent_at', null)
    .gte('hangout_date', fromDate)
    .lte('hangout_date', toDate)
  if (hangoutsError) console.error('Could not read hangouts', hangoutsError.message)

  for (const h of (hangouts ?? []).filter((h) => startsSoon(h.hangout_date, h.hangout_time))) {
    // The host is in hangout_attendees too, so one list covers everyone going
    const { data: people } = await db.from('hangout_attendees').select('user_id').eq('hangout_id', h.id)
    sent += await notifyUsers(db, (people ?? []).map((p) => p.user_id),
      `Reminder: the hangout "${h.title}" is on ${formatWhen(h.hangout_date, h.hangout_time)} at ${h.place_name}.\n\n${openApp('/app/hangouts')}`)
    await db.from('hangouts').update({ reminder_sent_at: now.toISOString() }).eq('id', h.id)
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
