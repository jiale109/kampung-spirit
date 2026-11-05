// send-reminders: run every hour by a Supabase Cron job. Sends, once each:
//   - a reminder about a day before each skill swap and hangout, to everyone
//     going (host included)
//   - a reminder about a day before each accepted help request, to the helper
//     and the person who asked
//   - "nobody could help in time" when an open request's time passes, to the
//     person who asked
//   - "please confirm" a day after the helper said a request was done, if the
//     person who asked has not confirmed yet
//
// Each one sets a *_sent_at column so the next run skips it. Something made
// less than a day ahead gets its reminder on the next hourly run. The
// help_requests columns come from
// supabase/migrations/20261107120000_help_request_reminders.sql.
//
// Deploy with:  supabase functions deploy send-reminders   (JWT checking is off in supabase/config.toml)
// The cron job must send the header  x-notify-secret: <NOTIFY_SECRET>.
//
// Secrets: TELEGRAM_BOT_TOKEN, NOTIFY_SECRET (optional: APP_URL)

import { adminClient, formatWhen, isTrustedCaller, nameOf, notifyUsers, openApp, singaporeMoment } from '../_shared/telegram.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Only requests whose time passed in the last week get "nobody could help",
// so the first run does not message people about months-old requests
const EXPIRED_LOOK_BACK_MS = 7 * DAY_MS

// A help request's needed_at as "Saturday 1 November, 3:00 pm" (Singapore time)
function formatNeededAt(iso) {
  const sg = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000).toISOString()
  return formatWhen(sg.slice(0, 10), sg.slice(11, 16))
}

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

  // ---- Help requests: about a day before, to the helper and the person who asked ----
  const { data: upcoming, error: upcomingError } = await db
    .from('help_requests')
    .select('id, title, location, needed_at, requester_id, helper_id')
    .eq('status', 'accepted')
    .is('reminder_sent_at', null)
    .gt('needed_at', now.toISOString())
    .lte('needed_at', until.toISOString())
  if (upcomingError) console.error('Could not read help_requests (reminders)', upcomingError.message)

  for (const r of upcoming ?? []) {
    const when = formatNeededAt(r.needed_at)
    const helper = await nameOf(db, r.helper_id)
    const asker = await nameOf(db, r.requester_id)
    sent += await notifyUsers(db, [r.helper_id],
      `Reminder: you are helping ${asker} with "${r.title}" on ${when}. Meet at ${r.location}.\n\n${openApp('/app/tasks')}`)
    sent += await notifyUsers(db, [r.requester_id],
      `Reminder: ${helper} is coming to help with "${r.title}" on ${when}, at ${r.location}.\n\n${openApp('/app/requests')}`)
    await db.from('help_requests').update({ reminder_sent_at: now.toISOString() }).eq('id', r.id)
  }

  // ---- Help requests: the time went by and nobody accepted ----
  const { data: expired, error: expiredError } = await db
    .from('help_requests')
    .select('id, title, needed_at, requester_id')
    .eq('status', 'open')
    .is('expired_notice_sent_at', null)
    .lt('needed_at', now.toISOString())
    .gte('needed_at', new Date(now.getTime() - EXPIRED_LOOK_BACK_MS).toISOString())
  if (expiredError) console.error('Could not read help_requests (expired)', expiredError.message)

  for (const r of expired ?? []) {
    sent += await notifyUsers(db, [r.requester_id],
      `Sorry, nobody was able to help with "${r.title}" on ${formatNeededAt(r.needed_at)}. `
      + `You can choose a new time and it goes back on the Help Board: press "Reschedule" on My Requests.\n\n${openApp('/app/requests')}`)
    await db.from('help_requests').update({ expired_notice_sent_at: now.toISOString() }).eq('id', r.id)
  }

  // ---- Help requests: done a day ago, still not confirmed ----
  const { data: unconfirmed, error: unconfirmedError } = await db
    .from('help_requests')
    .select('id, title, requester_id, helper_id')
    .eq('status', 'pending_confirmation')
    .is('confirm_nudge_sent_at', null)
    .lte('marked_done_at', new Date(now.getTime() - DAY_MS).toISOString())
  if (unconfirmedError) console.error('Could not read help_requests (unconfirmed)', unconfirmedError.message)

  for (const r of unconfirmed ?? []) {
    const helper = await nameOf(db, r.helper_id)
    sent += await notifyUsers(db, [r.requester_id],
      `Did ${helper} help you with "${r.title}"? Please open Kampung Spirit and press "Yes, ${helper} helped me", `
      + `so they get their points.\n\n${openApp('/app/requests')}`)
    await db.from('help_requests').update({ confirm_nudge_sent_at: now.toISOString() }).eq('id', r.id)
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
