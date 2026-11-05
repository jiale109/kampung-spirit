<script setup>
import { ref, computed } from 'vue'
import LanguageBar from './LanguageBar.vue'
import { useSkillSwapStore } from '../stores/skillSwap.js'
import { t, translate, chosenLanguage } from '../lib/translate.js'
import {
  formatDate,
  formatTime,
  formatDuration,
  categoryClass,
} from '../lib/skillSwapFormat.js'
 
const props = defineProps({
  session: { type: Object, required: true },
  // Admin view: only a Delete button, no joining or hosting buttons
  admin: { type: Boolean, default: false },
})
const emit = defineEmits(['join', 'leave', 'cancel', 'complete', 'delete'])
 
const store = useSkillSwapStore()
 
// ---- who is looking at this card ----
const isHost = computed(() => store.isHost(props.session))
const isJoined = computed(() => store.isAttending(props.session))
/*
  The two pieces only a machine can translate; the rest comes from the table
  in lib/translate.js. Same shape as RequestCard and HangoutCard.
*/
const shownTitle = ref('')
const shownDesc = ref('')
const wordsBusy = ref(false)
const wordsFailed = ref(false)

const title = computed(() => shownTitle.value || props.session.title)
const description = computed(() => shownDesc.value || props.session.description)

async function loadWords(code) {
  wordsFailed.value = false
  if (!code) {
    shownTitle.value = ''
    shownDesc.value = ''
    return
  }
  wordsBusy.value = true
  const [titleAnswer, descAnswer] = await Promise.all([
    translate(props.session.title, code),
    translate(props.session.description, code),
  ])
  // Only keep them if this is still the language being read
  if (chosenLanguage.value === code) {
    shownTitle.value = titleAnswer.ok ? titleAnswer.text : ''
    shownDesc.value = descAnswer.ok ? descAnswer.text : ''
    wordsFailed.value = !titleAnswer.ok || !descAnswer.ok
  }
  wordsBusy.value = false
}

const spots = computed(() => store.spotsLeft(props.session))
const isFull = computed(() => spots.value <= 0 && !isHost.value && !isJoined.value)
// Too late to join once it has started; the host can only mark it done after that
// (the database checks this too). The store's clock updates every minute.
const hasStarted = computed(() => store.hasStarted(props.session))
const hasEnded = computed(() => store.hasEnded(props.session))
const canJoin = computed(() => !isHost.value && !isJoined.value && !isFull.value && !hasStarted.value)
 
// Status is always words (the pill also has a dot), never colour alone.
const status = computed(() => {
  if (isHost.value && hasEnded.value) return { label: t('Waiting for you to mark as done'), cls: 'status-pending' }
  if (isHost.value) return { label: t('You are hosting'), cls: 'status-accepted' }
  if (isJoined.value) return { label: t('You are going'), cls: 'status-open' }
  if (isFull.value) return { label: t('Full'), cls: 'status-pending' }
  return {
    label: spots.value === 1 ? t('1 spot left') : t('{n} spots left', { n: spots.value }),
    cls: 'status-completed',
  }
})
 
const spotsText = computed(() => {
  if (spots.value <= 0) return t('No spots left')
  const n = spots.value === 1 ? t('1 spot left') : t('{n} spots left', { n: spots.value })
  // A number beside a number reads the same in every language, so "out of"
  // becomes a slash rather than a phrase that needs translating
  return `${n} / ${props.session.capacity}`
})
 
// ---- open and close the details ----
// hover opens the card for mouse users. tap/enter/click pins card
// until it is pressed again, so touch and keyboard users can open it too.
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
 
const detailsId = computed(() => `swap-details-${props.session.id}`)
</script>
 
<template>
  <article
    class="card request-card"
    :class="[categoryClass(session.category), { 'is-expanded': open }]"
    data-testid="session-card"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
  >
    <div class="card-body">
      <div class="request-top">
        <span class="status-pill" :class="status.cls">{{ status.label }}</span>
      </div>
 
      <h2 class="request-title">
        <button
          type="button"
          class="request-toggle"
          :aria-expanded="open"
          :aria-controls="detailsId"
          @click="toggle"
        >
          {{ title }}
        </button>
      </h2>
 
      <span class="request-hint">
        {{ formatDate(session.date) }} · {{ formatTime(session.time) }}<template v-if="!open"> · Tap for details</template>
      </span>
 
      <div :id="detailsId" class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ description }}</p>

          <!-- Under the words, never instead of them -->
          <LanguageBar @change="loadWords" />

          <p v-if="wordsBusy" class="translate-note">{{ t('Translating…') }}</p>
          <p v-else-if="wordsFailed" class="translate-problem" role="status">
            {{ t('This part could not be translated, so the original is shown.') }}
          </p>
          <p v-else-if="chosenLanguage" class="translate-note">
            {{ t('Translated by machine. The words above are the original.') }}
          </p>
 
          <dl class="request-facts">
            <div>
              <dt>{{ t('Day') }}</dt>
              <dd>{{ formatDate(session.date) }}</dd>
            </div>
            <div>
              <dt>{{ t('Time') }}</dt>
              <dd>{{ formatTime(session.time) }} · {{ formatDuration(session.duration) }}</dd>
            </div>
            <div v-if="session.venue">
              <dt>{{ t('Where') }}</dt>
              <dd>{{ session.venue }}</dd>
            </div>
            <div>
              <dt>{{ t('Spots') }}</dt>
              <dd data-testid="spots-text">{{ spotsText }}</dd>
            </div>
          </dl>
 
          <p class="request-people">
            <span>{{ t('Hosted by') }} <strong>{{ isHost ? t('you') : session.hostName }}</strong></span>
          </p>
 
          <div v-if="admin" class="request-actions">
            <button type="button" class="btn btn-outline-danger" data-testid="admin-delete"
              @click="emit('delete', session)">Delete</button>
          </div>
          <div v-else class="request-actions">
            <button v-if="canJoin" type="button" class="btn btn-primary btn-lg" @click="emit('join', session)">
              {{ t('Join this session') }}
            </button>
 
            <button v-if="isJoined" type="button" class="btn btn-outline-primary btn-lg" @click="emit('leave', session)">
              {{ t('Cancel my place') }}
            </button>
 
            <button v-if="isFull" type="button" class="btn btn-primary btn-lg" disabled>
              {{ t('Session full') }}
            </button>
 
            <template v-if="isHost">
              <button v-if="hasStarted" type="button" class="btn btn-primary btn-lg" @click="emit('complete', session)">
                {{ t('Mark as completed') }}
              </button>
              <p v-else class="request-note mb-0" data-testid="complete-later">
                {{ t('You can mark this as done once it has started.') }}
              </p>
              <button type="button" class="btn btn-outline-danger" @click="emit('cancel', session)">
                {{ t('Cancel this session') }}
              </button>
            </template>
          </div>
 
          <p v-if="isFull" class="request-note">
            {{ t('All places are taken. Look out for the next session from this host.') }}
          </p>
        </div>
      </div>
    </div>
  </article>
</template>
 