<script setup>
import { ref, computed } from 'vue'
import { useSkillSwapStore } from '../stores/skillSwap'
import {
  formatDate,
  formatTime,
  formatDuration,
  categoryClass,
} from '../lib/skillSwapFormat'
 
const props = defineProps({
  session: { type: Object, required: true },
})
const emit = defineEmits(['join', 'leave', 'cancel', 'complete'])
 
const store = useSkillSwapStore()
 
// ---- who is looking at this card ----
const isHost = computed(() => store.isHost(props.session))
const isJoined = computed(() => store.isAttending(props.session))
const spots = computed(() => store.spotsLeft(props.session))
const isFull = computed(() => spots.value <= 0 && !isHost.value && !isJoined.value)
const canJoin = computed(() => !isHost.value && !isJoined.value && !isFull.value)
 
// Status is always words (the pill also has a dot), never colour alone.
const status = computed(() => {
  if (isHost.value) return { label: 'You are hosting', cls: 'status-accepted' }
  if (isJoined.value) return { label: 'You are going', cls: 'status-open' }
  if (isFull.value) return { label: 'Full', cls: 'status-pending' }
  return {
    label: spots.value === 1 ? '1 spot left' : `${spots.value} spots left`,
    cls: 'status-completed',
  }
})
 
const spotsText = computed(() => {
  if (spots.value <= 0) return 'No spots left'
  const n = spots.value === 1 ? '1 spot left' : `${spots.value} spots left`
  return `${n} out of ${props.session.capacity}`
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
        <span class="category-label">
          <span class="category-icon" aria-hidden="true">{{ categoryIcon(session.category) }}</span>
          {{ session.category }}
        </span>
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
          {{ session.title }}
        </button>
      </h2>
 
      <span class="request-hint">
        {{ formatDate(session.date) }} · {{ formatTime(session.time) }}<template v-if="!open"> · Tap for details</template>
      </span>
 
      <div :id="detailsId" class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ session.description }}</p>
 
          <dl class="request-facts">
            <div>
              <dt>Day</dt>
              <dd>{{ formatDate(session.date) }}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{{ formatTime(session.time) }} · {{ formatDuration(session.duration) }}</dd>
            </div>
            <div v-if="session.venue">
              <dt>Where</dt>
              <dd>{{ session.venue }}</dd>
            </div>
            <div>
              <dt>Spots</dt>
              <dd data-testid="spots-text">{{ spotsText }}</dd>
            </div>
          </dl>
 
          <p class="request-people">
            <span>Hosted by <strong>{{ isHost ? 'you' : session.hostName }}</strong></span>
          </p>
 
          <div class="request-actions">
            <button v-if="canJoin" type="button" class="btn btn-primary btn-lg" @click="emit('join', session)">
              Join this session
            </button>
 
            <button v-if="isJoined" type="button" class="btn btn-outline-primary btn-lg" @click="emit('leave', session)">
              Cancel my place
            </button>
 
            <button v-if="isFull" type="button" class="btn btn-primary btn-lg" disabled>
              Session full
            </button>
 
            <template v-if="isHost">
              <button type="button" class="btn btn-primary btn-lg" @click="emit('complete', session)">
                Mark as completed
              </button>
              <button type="button" class="btn btn-outline-danger" @click="emit('cancel', session)">
                Cancel this session
              </button>
            </template>
          </div>
 
          <p v-if="isFull" class="request-note">
            All places are taken. Look out for the next session from this host.
          </p>
        </div>
      </div>
    </div>
  </article>
</template>
 