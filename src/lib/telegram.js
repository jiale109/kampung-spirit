/*
  Telegram updates (used by components/TelegramConnect.vue on the Profile page).

  The website never talks to Telegram itself: the bot token must stay secret.
  It only:
    - reads whether you are linked (telegram_links, your own row only)
    - asks the database for a one-time code and builds the t.me Start link
    - calls our telegram-account Edge Function with axios to send a test
      message (POST) or disconnect (DELETE)
  Everything else (linking, notifications, reminders) happens in the Edge
  Functions in supabase/functions/. Every function returns { ok, ... } or
  { ok: false, error: 'Plain message' }.

  Needs VITE_TELEGRAM_BOT_USERNAME in .env, e.g. KampungSpirit_Bot (no @).
*/
import axios from 'axios'
import { supabase } from './supabase.js'

export const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || ''
const ACCOUNT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-account`

// How long a Start link works (must match the database: 10 minutes)
export const LINK_MINUTES = 10

export async function getTelegramLink(userId) {
  const { data, error } = await supabase
    .from('telegram_links').select('linked_at').eq('user_id', userId).maybeSingle()
  if (error) return { ok: false, error: 'We could not check your Telegram connection.' }
  return { ok: true, linked: !!data, linkedAt: data?.linked_at ?? null }
}

export async function createStartLink() {
  const { data: code, error } = await supabase.rpc('create_telegram_link_code')
  if (error) return { ok: false, error: error.message }
  return { ok: true, url: `https://t.me/${BOT_USERNAME}?start=${code}` }
}

// The Edge Function knows who you are from your login token, so nothing else is sent
async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
}

const failure = (e) => ({
  ok: false,
  error: e.response?.data?.error ?? 'We could not reach Kampung Spirit. Please check your internet and try again.',
})

export async function sendTestMessage() {
  try {
    await axios.post(ACCOUNT_URL, {}, { headers: await authHeaders() })
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

export async function disconnectTelegram() {
  try {
    await axios.delete(ACCOUNT_URL, { headers: await authHeaders() })
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}
