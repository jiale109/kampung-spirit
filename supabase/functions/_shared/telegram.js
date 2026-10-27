// Shared by the Kampung Spirit Edge Functions (Deno, runs on Supabase, not in
// the browser). Sends Telegram messages and looks things up with full access.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN       from @BotFather. Never put it in the app or git.
//   NOTIFY_SECRET            a long random string; the database webhooks and the
//                            reminder job send it in the x-notify-secret header
//   APP_URL                  optional, e.g. https://kampung-spirit.vercel.app,
//                            so messages can link back to the site
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')

/** A database client that ignores RLS. Only use it inside these functions. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

/** Send plain text to one Telegram chat. Returns true when Telegram accepted it. */
export async function sendMessage(chatId, text) {
  if (!TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set')
    return false
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
  })
  if (!res.ok) console.error('Telegram sendMessage failed', res.status, await res.text())
  return res.ok
}

/**
 * Send one message to each of these Kampung Spirit users who linked Telegram.
 * People who did not link Telegram are simply skipped. Returns how many were sent.
 */
export async function notifyUsers(db, userIds, text) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return 0

  const { data, error } = await db.from('telegram_links').select('chat_id').in('user_id', ids)
  if (error) {
    console.error('Could not read telegram_links', error.message)
    return 0
  }

  let sent = 0
  for (const row of data) if (await sendMessage(row.chat_id, text)) sent++
  return sent
}

/** A person's name for messages. Never their block or anything private. */
export async function nameOf(db, userId) {
  if (!userId) return 'A neighbour'
  const { data } = await db.from('profiles').select('name').eq('id', userId).maybeSingle()
  return data?.name ?? 'A neighbour'
}

/** "Saturday 1 November, 3:00 pm" from '2026-11-01' and '15:00:00' (Singapore time) */
export function formatWhen(date, time) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December']
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const weekday = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${weekday} ${d} ${months[m - 1]}, ${hour12}:${String(min).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** When a date + time in Singapore happens, as a real moment */
export function singaporeMoment(date, time) {
  return new Date(`${date}T${time.slice(0, 5)}:00+08:00`)
}

/** "Open Kampung Spirit: https://.../app/requests", or a plain hint if APP_URL is not set */
export function openApp(path = '/app') {
  return APP_URL ? `Open Kampung Spirit: ${APP_URL}${path}` : 'Open Kampung Spirit to see the details.'
}

/** True when the request carries our NOTIFY_SECRET (database webhooks, the reminder job) */
export function isTrustedCaller(req) {
  const secret = Deno.env.get('NOTIFY_SECRET')
  return !!secret && req.headers.get('x-notify-secret') === secret
}

/** CORS headers, for the one function the website calls directly (telegram-account) */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
}
