/*
  "Get this on Telegram?" after someone posts, hosts, joins or accepts.

  Any page calls askToLinkTelegram('request') (or another reason) once the
  action has worked. components/TelegramPrompt.vue, shown once in
  MainLayout.vue, then opens if all of these are true:
    - the website has a bot (VITE_TELEGRAM_BOT_USERNAME)
    - the person has not linked Telegram yet
    - they have not ticked "Don't ask me again" on this browser
  "Not now" only closes it, so it comes back after the next action.
  The reason is shared by every component, so there is only ever one prompt.

  "Don't ask me again" lives in this browser only (local storage).
  Profile -> Telegram updates always works either way.
*/
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { BOT_USERNAME, getTelegramLink } from '../lib/telegram.js'

const reason = ref('') // '' while the prompt is closed

const flagKey = (userId) => `telegram-prompt-off:${userId}`

// Storage can be blocked (private windows, strict settings), so never let it break the page
function hasFlag(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setFlag(key) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Nothing to do: the prompt simply may come back
  }
}

export function useTelegramPrompt() {
  const auth = useAuthStore()

  async function askToLinkTelegram(why) {
    const userId = auth.user?.id
    if (!BOT_USERNAME || !userId) return
    // Automated tests (Playwright) would have the prompt cover the page they check
    if (navigator.webdriver) return

    if (hasFlag(flagKey(userId))) return

    const result = await getTelegramLink(userId)
    if (!result.ok || result.linked) return
    reason.value = why
  }

  function close() {
    reason.value = ''
  }

  function neverAsk() {
    if (auth.user) setFlag(flagKey(auth.user.id))
    close()
  }

  return { reason, askToLinkTelegram, close, neverAsk }
}
