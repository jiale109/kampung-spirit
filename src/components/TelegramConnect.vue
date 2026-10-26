<script setup>
/*
  "Telegram updates" card on the Profile page. Three states:
    1. Not connected: one button, "Get updates on Telegram"
    2. Waiting: a big "Open Telegram" link and three short steps. The page
       checks every few seconds and switches to 3 by itself once they tap Start.
    3. Connected: "Send me a test message" and "Disconnect Telegram"
  See lib/telegram.js for what each button calls.
*/
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import {
  BOT_USERNAME, LINK_MINUTES, getTelegramLink, createStartLink, sendTestMessage, disconnectTelegram,
} from '../lib/telegram.js'

const auth = useAuthStore()

const checking = ref(true)
const linked = ref(false)
const startUrl = ref('') // set while waiting for them to tap Start
const busy = ref(false)
const message = ref('')
const error = ref('')

let pollTimer = null
let expiryTimer = null

function stopWaiting() {
  clearInterval(pollTimer)
  clearTimeout(expiryTimer)
  startUrl.value = ''
}

async function refresh() {
  const result = await getTelegramLink(auth.user.id)
  if (!result.ok) {
    error.value = result.error
    return
  }
  linked.value = result.linked
  if (linked.value && startUrl.value) {
    stopWaiting()
    message.value = 'Telegram is connected. We sent you a welcome message there.'
  }
}

async function connect() {
  message.value = ''
  error.value = ''
  busy.value = true
  const result = await createStartLink()
  busy.value = false
  if (!result.ok) {
    error.value = result.error
    return
  }

  startUrl.value = result.url
  pollTimer = setInterval(refresh, 4000)
  expiryTimer = setTimeout(() => {
    stopWaiting()
    error.value = 'The Telegram link has expired. Press "Get updates on Telegram" to get a new one.'
  }, LINK_MINUTES * 60 * 1000)
}

async function test() {
  message.value = ''
  error.value = ''
  busy.value = true
  const result = await sendTestMessage()
  busy.value = false
  if (result.ok) message.value = 'Sent! Check Telegram for a message from Kampung Spirit.'
  else error.value = result.error
}

async function disconnect() {
  message.value = ''
  error.value = ''
  busy.value = true
  const result = await disconnectTelegram()
  busy.value = false
  if (result.ok) {
    linked.value = false
    message.value = 'Telegram is disconnected. You will not get any more messages there.'
  } else {
    error.value = result.error
  }
}

onMounted(async () => {
  await refresh()
  checking.value = false
})
onUnmounted(stopWaiting)
</script>

<template>
  <div class="card" data-testid="telegram-card">
    <div class="card-body p-4">
      <h2 class="page-title fs-4">Telegram updates</h2>
      <p class="page-subtitle mb-3">
        Get a message on Telegram when a neighbour accepts your request, when someone joins your skill swap
        or hangout, and a reminder the day before.
      </p>

      <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
      <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

      <p v-if="!BOT_USERNAME" class="mb-0">Telegram updates are not set up on this website yet.</p>

      <p v-else-if="checking" class="mb-0">Checking…</p>

      <!-- 3. Connected -->
      <template v-else-if="linked">
        <p class="mb-3 fw-bold" data-testid="telegram-status">✓ Telegram is connected</p>
        <div class="d-flex flex-wrap gap-3">
          <button type="button" class="btn btn-outline-primary btn-lg" :disabled="busy" @click="test">
            Send me a test message
          </button>
          <button type="button" class="btn btn-outline-danger btn-lg" :disabled="busy" @click="disconnect">
            Disconnect Telegram
          </button>
        </div>
      </template>

      <!-- 2. Waiting for them to tap Start -->
      <template v-else-if="startUrl">
        <ol class="telegram-steps">
          <li>Press <strong>Open Telegram</strong> below. The Telegram app will open.</li>
          <li>Tap the blue <strong>START</strong> button at the bottom of the chat.</li>
          <li>Come back here. This page will update by itself.</li>
        </ol>
        <div class="d-flex flex-wrap gap-3 align-items-center">
          <a :href="startUrl" target="_blank" rel="noopener" class="btn btn-primary btn-lg">Open Telegram</a>
          <button type="button" class="btn btn-outline-secondary btn-lg" @click="refresh">I have tapped Start</button>
        </div>
        <p class="form-text mt-3 mb-0">This link works for {{ LINK_MINUTES }} minutes and only for you.</p>
      </template>

      <!-- 1. Not connected -->
      <template v-else>
        <button type="button" class="btn btn-primary btn-lg" :disabled="busy" @click="connect">
          Get updates on Telegram
        </button>
        <p class="form-text mt-3 mb-0">
          You need the Telegram app. We never see your phone number, and you can stop the messages at any time.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.telegram-steps {
  margin-bottom: 1.25rem;
  padding-left: 1.4rem;
}

.telegram-steps li + li {
  margin-top: 0.4rem;
}
</style>
