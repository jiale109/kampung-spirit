<script setup>
/*
  The "Get this on Telegram?" pop-up. Shown once, in MainLayout.vue; pages
  open it through composables/useTelegramPrompt.js. The connecting itself is
  the same TelegramConnect card as on the Profile page, without its heading.
*/
import { ref, computed, watch, nextTick, useId } from 'vue'
import { useTelegramPrompt } from '../composables/useTelegramPrompt.js'
import TelegramConnect from './TelegramConnect.vue'

const { reason, close, neverAsk } = useTelegramPrompt()

// Why it is worth it, in the words of what they just did
const reasons = {
  request: 'Get a message on Telegram when a neighbour accepts your request, and when they say it is done.',
  accept: 'Get a message on Telegram if this request is cancelled, and when your points arrive.',
  hostHangout: 'Get a message on Telegram when neighbours join your hangout, and a reminder the day before.',
  joinHangout: 'Get a reminder on Telegram the day before, and a message if the hangout is cancelled.',
  hostSkillSwap: 'Get a message on Telegram when neighbours join your session, and a reminder the day before.',
  joinSkillSwap: 'Get a reminder on Telegram the day before, and a message if the session is cancelled.',
}
const text = computed(() => reasons[reason.value] ?? reasons.request)

const linked = ref(false)
const dontAsk = ref(false) // the "Don't ask me again" box

// Every way out (Not now, the cross, Escape, clicking outside) goes through here
function dismiss() {
  if (dontAsk.value && !linked.value) neverAsk()
  else close()
}

const titleId = useId()
const dontAskId = useId()
const dialog = ref(null)

function onKeydown(event) {
  if (event.key === 'Escape') dismiss()
}

// Move focus into the pop-up while it is open, and give it back afterwards
let previousFocus = null
watch(reason, async (now, before) => {
  if (now && !before) {
    linked.value = false
    dontAsk.value = false
    previousFocus = document.activeElement
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    dialog.value?.querySelector('button')?.focus()
  } else if (!now && before) {
    document.removeEventListener('keydown', onKeydown)
    previousFocus?.focus?.()
  }
})
</script>

<template>
  <div v-if="reason" data-testid="telegram-prompt">
    <div class="modal show" style="display: block;" role="dialog" aria-modal="true"
      :aria-labelledby="titleId" @click.self="dismiss">
      <div ref="dialog" class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">Get updates on Telegram?</h2>
            <button type="button" class="btn-close" aria-label="Close" @click="dismiss"></button>
          </div>
          <div class="modal-body">
            <p v-if="!linked">{{ text }}</p>
            <TelegramConnect compact @linked="linked = true" />
          </div>
          <div class="modal-footer">
            <button v-if="linked" type="button" class="btn btn-primary" @click="close">Done</button>
            <template v-else>
              <div class="form-check dont-ask me-auto mb-0">
                <input :id="dontAskId" v-model="dontAsk" type="checkbox" class="form-check-input"
                  data-testid="telegram-prompt-never" />
                <label :for="dontAskId" class="form-check-label">Don't ask me again</label>
              </div>
              <button type="button" class="btn btn-outline-secondary" data-testid="telegram-prompt-not-now"
                @click="dismiss">Not now</button>
              <!-- Kept at the usual small-text size (about 19px): fitting one line would need about 15px -->
              <p class="form-text w-100 text-center mt-2 mb-0">
                You can connect Telegram later from your
                <RouterLink to="/app/profile" @click="dismiss">Profile</RouterLink> page.
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  </div>
</template>

<style scoped>
/* A bigger box, easier to see and to press (Bootstrap's is only 1em) */
.dont-ask {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-left: 0;
}

.dont-ask .form-check-input {
  width: 1.5em;
  height: 1.5em;
  margin: 0;
  flex-shrink: 0;
}
</style>
