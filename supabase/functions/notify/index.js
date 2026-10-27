// notify: turns database changes into Telegram messages.
//
// Called by Supabase Database Webhooks (Database -> Webhooks), one per table:
//   help_requests            UPDATE   accepted / withdrawn / done / confirmed / cancelled
//   skill_session_attendees  INSERT   someone took a place in your skill swap
//                            DELETE   someone gave up their place
//   hangout_attendees        INSERT   someone is coming to your hangout
//                            DELETE   someone is no longer coming
//   skill_sessions           UPDATE   a skill swap you joined was cancelled
//   hangouts                 UPDATE   a hangout you joined was cancelled
//
// Deploy with:  supabase functions deploy notify   (JWT checking is off in supabase/config.toml)
// Each webhook must send the header  x-notify-secret: <NOTIFY_SECRET>.  A normal
// Supabase login token is NOT enough, or any logged-in user could call this
// with made-up data and message other people.
//
// Secrets: TELEGRAM_BOT_TOKEN, NOTIFY_SECRET (optional: APP_URL)
//
// Messages never include anyone's block, birth date or other private details.
// If Telegram or a lookup fails, the change in the app has already been saved;
// only the message is missed.

import { adminClient, formatWhen, isTrustedCaller, nameOf, notifyUsers, openApp } from '../_shared/telegram.js'

Deno.serve(async (req) => {
  if (!isTrustedCaller(req)) return new Response('Forbidden', { status: 403 })

  // { type: 'INSERT' | 'UPDATE' | 'DELETE', table, record, old_record }
  const payload = await req.json().catch(() => null)
  if (!payload?.table) return new Response('Nothing to do', { status: 400 })

  const db = adminClient()
  const { type, table, record: row, old_record: old } = payload

  try {
    if (table === 'help_requests' && type === 'UPDATE' && row && old) await helpRequestChanged(db, row, old)
    else if (table === 'skill_session_attendees' && type === 'INSERT' && row) await skillSwapJoined(db, row)
    else if (table === 'skill_session_attendees' && type === 'DELETE' && old) await skillSwapLeft(db, old)
    else if (table === 'hangout_attendees' && type === 'INSERT' && row) await hangoutJoined(db, row)
    else if (table === 'hangout_attendees' && type === 'DELETE' && old) await hangoutLeft(db, old)
    else if (table === 'skill_sessions' && type === 'UPDATE' && row && old) await skillSwapCancelled(db, row, old)
    else if (table === 'hangouts' && type === 'UPDATE' && row && old) await hangoutCancelled(db, row, old)
  } catch (e) {
    console.error('notify failed', table, type, e)
  }
  return new Response('ok')
})

// ---- Help Board ------------------------------------------------------------

async function helpRequestChanged(db, row, old) {
  if (row.status === old.status) return // only the title or details were edited
  const title = `"${row.title}"`

  // open -> accepted: tell the person who asked
  if (old.status === 'open' && row.status === 'accepted') {
    const helper = await nameOf(db, row.helper_id)
    await notifyUsers(db, [row.requester_id],
      `Good news! ${helper} will help you with ${title}.\n\n${openApp('/app/requests')}`)
  }

  // accepted -> open: the helper withdrew, so it is back on the board
  else if (old.status === 'accepted' && row.status === 'open') {
    const helper = await nameOf(db, old.helper_id)
    await notifyUsers(db, [row.requester_id],
      `${helper} can no longer help with ${title}. Your request is back on the Help Board for other neighbours.\n\n${openApp('/app/requests')}`)
  }

  // accepted -> pending_confirmation: ask the person who asked to confirm
  else if (row.status === 'pending_confirmation') {
    const helper = await nameOf(db, row.helper_id)
    await notifyUsers(db, [row.requester_id],
      `${helper} says ${title} is done. Did they help you? Please open Kampung Spirit and press "Yes, ${helper} helped me".\n\n${openApp('/app/requests')}`)
  }

  // pending_confirmation -> completed: thank the helper
  else if (row.status === 'completed') {
    await notifyUsers(db, [row.helper_id],
      `Thank you for helping! ${title} is confirmed and you earned ${row.points} points.\n\n${openApp('/app/rewards')}`)
  }

  // accepted -> cancelled: tell the helper not to go
  else if (row.status === 'cancelled' && old.helper_id) {
    await notifyUsers(db, [old.helper_id],
      `${title} has been cancelled by the person who asked. You do not need to go.\n\n${openApp('/app/tasks')}`)
  }
}

// ---- Skill swaps -----------------------------------------------------------

async function skillSwapJoined(db, row) {
  const { data: session } = await db
    .from('skill_sessions').select('title, host_id, capacity').eq('id', row.session_id).maybeSingle()
  if (!session || session.host_id === row.user_id) return

  const { count } = await db
    .from('skill_session_attendees').select('*', { count: 'exact', head: true }).eq('session_id', row.session_id)
  const who = await nameOf(db, row.user_id)
  const places = count != null ? ` (${count} of ${session.capacity} places taken)` : ''

  await notifyUsers(db, [session.host_id],
    `${who} joined your skill swap "${session.title}"${places}.\n\n${openApp('/app/skill-swaps')}`)
}

async function skillSwapLeft(db, old) {
  const { data: session } = await db
    .from('skill_sessions').select('title, host_id, capacity, status').eq('id', old.session_id).maybeSingle()
  // Only while the session is still on; nothing to say if it was removed or already finished
  if (!session || session.status !== 'open' || session.host_id === old.user_id) return

  const { count } = await db
    .from('skill_session_attendees').select('*', { count: 'exact', head: true }).eq('session_id', old.session_id)
  const who = await nameOf(db, old.user_id)
  const places = count != null ? ` (${count} of ${session.capacity} places taken)` : ''

  await notifyUsers(db, [session.host_id],
    `${who} can no longer come to your skill swap "${session.title}"${places}.\n\n${openApp('/app/skill-swaps')}`)
}

async function skillSwapCancelled(db, row, old) {
  if (old.status === 'cancelled' || row.status !== 'cancelled') return
  const { data: people } = await db.from('skill_session_attendees').select('user_id').eq('session_id', row.id)
  const attendees = (people ?? []).map((p) => p.user_id).filter((id) => id !== row.host_id)

  await notifyUsers(db, attendees,
    `Sorry, the skill swap "${row.title}" on ${formatWhen(row.session_date, row.session_time)} has been cancelled by the host.\n\n${openApp('/app/skill-swaps')}`)
}

// ---- Hangouts --------------------------------------------------------------

async function hangoutJoined(db, row) {
  const { data: hangout } = await db.from('hangouts').select('title, host_id').eq('id', row.hangout_id).maybeSingle()
  // The host is added as an attendee automatically when they propose it; skip that one
  if (!hangout || hangout.host_id === row.user_id) return

  const who = await nameOf(db, row.user_id)
  await notifyUsers(db, [hangout.host_id],
    `${who} is coming to your hangout "${hangout.title}".\n\n${openApp('/app/hangouts')}`)
}

async function hangoutLeft(db, old) {
  const { data: hangout } = await db
    .from('hangouts').select('title, host_id, status').eq('id', old.hangout_id).maybeSingle()
  if (!hangout || hangout.status !== 'open' || hangout.host_id === old.user_id) return

  const who = await nameOf(db, old.user_id)
  await notifyUsers(db, [hangout.host_id],
    `${who} is no longer coming to your hangout "${hangout.title}".\n\n${openApp('/app/hangouts')}`)
}

async function hangoutCancelled(db, row, old) {
  if (old.status === 'cancelled' || row.status !== 'cancelled') return
  const { data: people } = await db.from('hangout_attendees').select('user_id').eq('hangout_id', row.id)
  const attendees = (people ?? []).map((p) => p.user_id).filter((id) => id !== row.host_id)

  await notifyUsers(db, attendees,
    `Sorry, the hangout "${row.title}" at ${row.place_name} on ${formatWhen(row.hangout_date, row.hangout_time)} has been cancelled by the host.\n\n${openApp('/app/hangouts')}`)
}
