// telegram-account: called by the website (Profile page) with axios.
//
//   POST    send a test message to the logged-in person's Telegram
//   DELETE  disconnect their Telegram (and say goodbye there)
//
// Deploy with:  supabase functions deploy telegram-account
// (JWT checking stays on: the browser sends the person's login token, and we
// only ever act on THAT person's own link.)
//
// Secrets: TELEGRAM_BOT_TOKEN

import { adminClient, corsHeaders, sendMessage } from '../_shared/telegram.js'

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  // The browser asks first whether it may call us from the website (CORS)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = adminClient()

  // Who is calling? Trust only the login token, never an id sent in the body.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth?.user) return reply(401, { error: 'Please log in again.' })
  const userId = auth.user.id

  const { data: link } = await db.from('telegram_links').select('chat_id').eq('user_id', userId).maybeSingle()
  if (!link) return reply(404, { error: 'Your Telegram is not connected yet.' })

  if (req.method === 'POST') {
    const ok = await sendMessage(link.chat_id,
      'This is a test message from Kampung Spirit. Your updates are working!')
    return ok
      ? reply(200, { ok: true })
      : reply(502, { error: 'We could not reach Telegram. If you blocked the bot, unblock it and try again.' })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('telegram_links').delete().eq('user_id', userId)
    if (error) return reply(500, { error: 'We could not disconnect Telegram. Please try again.' })
    await sendMessage(link.chat_id,
      'You have disconnected Kampung Spirit. You will not get any more messages here. You can connect again from Profile at any time.')
    return reply(200, { ok: true })
  }

  return reply(405, { error: 'Not allowed' })
})
