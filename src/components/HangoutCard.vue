<script setup>
/*
  One hangout on the list                                Owner: Clarence Tay
  Built like components/SkillSwapCard.vue: the title is always visible and
  the details open on hover (mouse) or on tap/Enter (touch and keyboard),
  so the page stays calm.
  The card only shows things and emits what the person pressed. All the
  rules live in stores/hangout.js and supabase/schema.sql.
*/
import { ref, computed } from 'vue'
import { useHangoutStore } from '../stores/hangout.js'
import LanguageBar from './LanguageBar.vue'
import { formatDate, formatTime, formatDuration } from '../lib/skillSwapFormat.js'
import { t, translate, chosenLanguage } from '../lib/translate.js'

const props = defineProps({
  hangout: { type: Object, required: true },
  // Admin view: only a Delete button, no joining or hosting buttons
  admin: { type: Boolean, default: false },
})
const emit = defineEmits(['join', 'leave', 'cancel', 'complete', 'delete'])

const store = useHangoutStore()

const isHost = computed(() => store.isHost(props.hangout))
const isGoing = computed(() => store.isGoing(props.hangout))
// Too late to join once it has started; the host can only mark it done after that
// (the database checks this too). The store's clock updates every minute.
const hasStarted = computed(() => store.hasStarted(props.hangout))
const hasEnded = computed(() => store.hasEnded(props.hangout))
const canJoin = computed(() => !isHost.value && !isGoing.value && !hasStarted.value)

/*
  The two pieces only a machine can translate. Everything else on this card
  comes from the table in lib/translate.js - see RequestCard for the reasoning.
*/
const shownTitle = ref('')
const shownDesc = ref('')
const wordsBusy = ref(false)
const wordsFailed = ref(false)

const title = computed(() => shownTitle.value || props.hangout.title)
const description = computed(() => shownDesc.value || props.hangout.description)

async function loadWords(code) {
  wordsFailed.value = false
  if (!code) {
    shownTitle.value = ''
    shownDesc.value = ''
    return
  }
  wordsBusy.value = true
  const [titleAnswer, descAnswer] = await Promise.all([
    translate(props.hangout.title, code),
    translate(props.hangout.description, code),
  ])
  // Only keep them if this is still the language being read
  if (chosenLanguage.value === code) {
    shownTitle.value = titleAnswer.ok ? titleAnswer.text : ''
    shownDesc.value = descAnswer.ok ? descAnswer.text : ''
    wordsFailed.value = !titleAnswer.ok || !descAnswer.ok
  }
  wordsBusy.value = false
}

// Always words, never colour on its own (the pill has a dot as well)
const status = computed(() => {
  if (isHost.value && hasEnded.value) return { label: t('Waiting for you to mark as done'), cls: 'status-pending' }
  if (isHost.value) return { label: t('You are hosting'), cls: 'status-accepted' }
  if (isGoing.value) return { label: t('You are going'), cls: 'status-open' }
  return { label: t('Open to join'), cls: 'status-completed' }
})

const goingText = computed(() => {
  const n = store.goingCount(props.hangout)
  return n === 1 ? t('1 person going') : t('{n} people going', { n })
})

// ---- open and close the details ----
// Hover opens it for mouse users. Tap or Enter pins it open until pressed
// again, so touch and keyboard users can open it too.
const pinned = ref(false)
const hovering = ref(false)
const open = computed(() => pinned.value || hovering.value)

function onEnter(e) {
  if (e.pointerType === 'mouse') hovering.value = true
}
function onLeave(e) {
  if (e.pointerType === 'mouse') hovering.value = false
}
function toggle() {
  if (pinned.value) {
    pinned.value = false
    hovering.value = false
  } else {
    pinned.value = true
  }
}

const detailsId = computed(() => `hangout-details-${props.hangout.id}`)
</script>

<template>
  <article class="card request-card" :class="{ 'is-expanded': open }" data-testid="hangout-card"
    @pointerenter="onEnter" @pointerleave="onLeave">
    <div class="card-body">
      <div class="request-top">
        <span class="category-label">{{ hangout.placeName }}</span>
        <span class="status-pill" :class="status.cls">{{ status.label }}</span>
      </div>

      <h2 class="request-title">
        <button type="button" class="request-toggle" :aria-expanded="open" :aria-controls="detailsId" @click="toggle">
          {{ title }}
        </button>
      </h2>

      <span class="request-hint">
        {{ formatDate(hangout.date) }} &middot; {{ formatTime(hangout.time) }}<template v-if="!open"> &middot; {{ t('Tap for details') }}</template>
      </span>

      <div :id="detailsId" class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ description }}</p>

          <!-- Switches the whole card, in place -->
          <LanguageBar @change="loadWords" />

          <p v-if="wordsBusy" class="translate-note">{{ t('Translating…') }}</p>
          <p v-else-if="wordsFailed" class="translate-problem" role="status">
            {{ t('This part could not be translated, so the original is shown.') }}
          </p>
          <p v-else-if="chosenLanguage" class="translate-note">
            {{ t('Translated by machine. The words above are the original.') }}
          </p>

          <!-- Rain warning for outdoor places only. The page passes it in. -->
          <p v-if="hangout.weatherWarning" class="points-note" data-testid="weather-warning">
            {{ hangout.weatherWarning }}
          </p>

          <dl class="request-facts">
            <div>
              <dt>{{ t('Day') }}</dt>
              <dd>{{ formatDate(hangout.date) }}</dd>
            </div>
            <div>
              <dt>{{ t('Time') }}</dt>
              <dd>{{ formatTime(hangout.time) }} &middot; {{ formatDuration(hangout.duration) }}</dd>
            </div>
            <div>
              <dt>{{ t('Where') }}</dt>
              <dd>{{ hangout.placeName }}<template v-if="hangout.outdoor"> ({{ t('outdoors') }})</template></dd>
            </div>
            <div>
              <dt>{{ t('Going') }}</dt>
              <dd data-testid="going-text">{{ goingText }}</dd>
            </div>
          </dl>

          <p class="request-people">
            <span>{{ t('Hosted by') }} <strong>{{ isHost ? t('you') : hangout.hostName }}</strong></span>
          </p>

          <div v-if="admin" class="request-actions">
            <button type="button" class="btn btn-outline-danger" data-testid="admin-delete"
              @click="emit('delete', hangout)">Delete</button>
          </div>
          <div v-else class="request-actions">
            <button v-if="canJoin" type="button" class="btn btn-primary btn-lg" data-testid="join"
              @click="emit('join', hangout)">{{ t('I am coming') }}</button>

            <button v-if="isGoing && !isHost" type="button" class="btn btn-outline-primary btn-lg" data-testid="leave"
              @click="emit('leave', hangout)">{{ t('I cannot make it') }}</button>

            <template v-if="isHost">
              <button v-if="hasStarted" type="button" class="btn btn-primary btn-lg" data-testid="complete"
                @click="emit('complete', hangout)">{{ t('Mark as done') }}</button>
              <p v-else class="request-note mb-0" data-testid="complete-later">{{ t('You can mark this as done once it has started.') }}</p>
              <button type="button" class="btn btn-outline-danger" data-testid="cancel"
                @click="emit('cancel', hangout)">{{ t('Cancel this hangout') }}</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
