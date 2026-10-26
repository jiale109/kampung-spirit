// telegram-webhook: Telegram calls this whenever someone messages the bot.
//
//   /start <code>  link this Telegram chat to the Kampung Spirit account that
//                  made the code (Profile page -> "Get updates on Telegram")
//   /stop          unlink, no more messages
//   /help          what the bot does
//
// Deploy with:  supabase functions deploy telegram-webhook
// (JWT checking is off in supabase/config.toml: Telegram cannot send a Supabase login token. Instead, every request must
// carry the secret we gave Telegram in setWebhook; anything else is refused.)
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

import { adminClient, sendMessage } from '../_shared/telegram.js'

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')

const HELP_TEXT = [
  'I send short messages from Kampung Spirit:',
  '• when a neighbour agrees to help with your request',
  '• when your helper says the task is done',
  '• when you earn points',
  '• when someone joins your skill swap or hangout',
  '• a reminder the day before a skill swap or hangout you joined',
  '',
  'To connect, open Kampung Spirit, go to Profile and press "Get updates on Telegram".',
  'Send /stop to turn messages off.',
  '',
  'I will never ask for your password, bank details or phone number.',
].join('\n')

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  const update = await req.json().catch(() => null)
  const message = update?.message
  const chatId = message?.chat?.id
  const text = (message?.text ?? '').trim()

  // Only private chats, and only text. Always answer 200 so Telegram does not resend.
  if (!chatId || message.chat.type !== 'private' || !text) return new Response('ok')

  const db = adminClient()
  const [command, arg = ''] = text.split(/\s+/, 2)

  if (command === '/start' && arg) {
    await link(db, chatId, arg)
  } else if (command === '/stop') {
    const { count } = await db.from('telegram_links').delete({ count: 'exact' }).eq('chat_id', chatId)
    await sendMessage(chatId, count
      ? 'Done. You will not get any more messages from Kampung Spirit. To turn them on again, go to Profile on the website.'
      : 'This Telegram is not connected to a Kampung Spirit account.')
  } else {
    // /help, a plain /start (opened the bot without the website's link), or anything else
    await sendMessage(chatId, HELP_TEXT)
  }

  return new Response('ok')
})

async function link(db, chatId, code) {
  const { data: found, error: lookupError } = await db
    .from('telegram_link_codes')
    .select('user_id')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (lookupError) {
    // Not the person's fault (e.g. missing permissions), so do not say "expired"
    console.error('Could not read telegram_link_codes', lookupError.message)
    await sendMessage(chatId, 'Sorry, something went wrong on our side. Please try again later.')
    return
  }

  if (!found) {
    await sendMessage(chatId,
      'That link has expired. Please go back to Kampung Spirit, open Profile and press "Get updates on Telegram" again.')
    return
  }

  // A code works once
  await db.from('telegram_link_codes').delete().eq('code', code)

  // One Telegram chat per account: move this chat away from any other account first
  await db.from('telegram_links').delete().eq('chat_id', chatId)
  const { error } = await db
    .from('telegram_links')
    .upsert({ user_id: found.user_id, chat_id: chatId, linked_at: new Date().toISOString() })

  if (error) {
    console.error('Could not save telegram link', error.message)
    await sendMessage(chatId, 'Sorry, something went wrong. Please try again from the Profile page.')
    return
  }

  const { data: profile } = await db.from('profiles').select('name').eq('id', found.user_id).maybeSingle()
  await sendMessage(chatId,
    `You are connected, ${profile?.name ?? 'neighbour'}! I will message you here about your Kampung Spirit requests, skill swaps and hangouts.\n\nSend /stop at any time to turn messages off.`)
}
