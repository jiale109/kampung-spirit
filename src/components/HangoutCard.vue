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
import { hotspotName, findHotspot } from '../lib/hotspots.js'
import { formatDate, formatTime, formatDuration } from '../lib/skillSwapFormat.js'

const props = defineProps({
  hangout: { type: Object, required: true },
})
const emit = defineEmits(['join', 'leave', 'cancel', 'complete'])

const store = useHangoutStore()

const isHost = computed(() => store.isHost(props.hangout))
const isGoing = computed(() => store.isGoing(props.hangout))
const canJoin = computed(() => !isHost.value && !isGoing.value)

const hotspot = computed(() => findHotspot(props.hangout.hotspotId))

// Always words, never colour on its own (the pill has a dot as well)
const status = computed(() => {
  if (isHost.value) return { label: 'You are hosting', cls: 'status-accepted' }
  if (isGoing.value) return { label: 'You are going', cls: 'status-open' }
  return { label: 'Open to join', cls: 'status-completed' }
})

const goingText = computed(() => {
  const n = store.goingCount(props.hangout)
  return n === 1 ? '1 person going' : `${n} people going`
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
        <span class="category-label">{{ hotspotName(hangout.hotspotId) }}</span>
        <span class="status-pill" :class="status.cls">{{ status.label }}</span>
      </div>

      <h2 class="request-title">
        <button type="button" class="request-toggle" :aria-expanded="open" :aria-controls="detailsId" @click="toggle">
          {{ hangout.title }}
        </button>
      </h2>

      <span class="request-hint">
        {{ formatDate(hangout.date) }} &middot; {{ formatTime(hangout.time) }}<template v-if="!open"> &middot; Tap for details</template>
      </span>

      <div :id="detailsId" class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ hangout.description }}</p>

          <!-- Rain warning for outdoor places only. The page passes it in. -->
          <p v-if="hangout.weatherWarning" class="points-note" data-testid="weather-warning">
            {{ hangout.weatherWarning }}
          </p>

          <dl class="request-facts">
            <div>
              <dt>Day</dt>
              <dd>{{ formatDate(hangout.date) }}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{{ formatTime(hangout.time) }} &middot; {{ formatDuration(hangout.duration) }}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{{ hotspotName(hangout.hotspotId) }}<template v-if="hotspot?.outdoor"> (outdoors)</template></dd>
            </div>
            <div>
              <dt>Going</dt>
              <dd data-testid="going-text">{{ goingText }}</dd>
            </div>
          </dl>

          <p class="request-people">
            <span>Hosted by <strong>{{ isHost ? 'you' : hangout.hostName }}</strong></span>
          </p>

          <div class="request-actions">
            <button v-if="canJoin" type="button" class="btn btn-primary btn-lg" data-testid="join"
              @click="emit('join', hangout)">I am coming</button>

            <button v-if="isGoing && !isHost" type="button" class="btn btn-outline-primary btn-lg" data-testid="leave"
              @click="emit('leave', hangout)">I cannot make it</button>

            <template v-if="isHost">
              <button type="button" class="btn btn-primary btn-lg" data-testid="complete"
                @click="emit('complete', hangout)">Mark as done</button>
              <button type="button" class="btn btn-outline-danger" data-testid="cancel"
                @click="emit('cancel', hangout)">Cancel this hangout</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
