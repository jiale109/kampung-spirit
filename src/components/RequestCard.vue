<script setup>
import { ref, computed } from 'vue'
import CategoryBadge from './CategoryBadge.vue'
import StatusBadge from './StatusBadge.vue'
import RequestMapModal from './RequestMapModal.vue'
import { categoryClass, categories } from '../lib/points.js'
import { formatNeededAt } from '../stores/helpRequest.js'


const props = defineProps({
  request: { type: Object, required: true },
  // The senior's own board already knows who is asking, so it hides the name (the place always shows)
  showRequester: { type: Boolean, default: true },
  // A youth's own task list already knows who the helper is (themselves)
  showHelper: { type: Boolean, default: true },
  // On the youth Help Board every request is "Open", so the badge adds nothing
  hideStatus: { type: Boolean, default: false },
  // Keep the card open, for example when the senior has something to confirm
  open: { type: Boolean, default: false },
  // Youth Help Board: show points, time and effort on the closed card so helpers can compare at a glance
  compact: { type: Boolean, default: false },
  // Who is looking ('requester' or 'helper'), so the status is worded for them
  viewer: { type: String, default: '' },
  // Youth Help Board: say how long an open request has been waiting (from 2 days)
  showWaiting: { type: Boolean, default: false },
})

const categoryIcon = computed(() => categories.find((c) => c.name === props.request.category)?.icon)

// ---- open and close the details (same idea as HangoutCard.vue) ----
// Hover opens it for mouse users. A click, tap or Enter pins it open until
// pressed again, so touch and keyboard users can open it too. Only a real
// mouse counts as hovering, so a tap on a phone never opens it by hover.
const pinned = ref(false)
const hovering = ref(false)
const expanded = computed(() => props.open || pinned.value || hovering.value)

function onEnter(e) {
  if (e.pointerType === 'mouse') hovering.value = true
}
function onLeave(e) {
  if (e.pointerType === 'mouse') hovering.value = false
}
// Unpinning also clears hovering, so "Hide details" closes the card even
// while the mouse is still over it
function toggle() {
  if (pinned.value) {
    pinned.value = false
    hovering.value = false
  } else {
    pinned.value = true
  }
}

const hint = computed(() => {
  if (pinned.value) return 'Hide details ▴'
  if (hovering.value) return 'Click to keep open ▾'
  return 'Show details ▾'
})

// Pin first, so the map popup does not close the card when the mouse moves onto it
function openMap() {
  pinned.value = true
  showMap.value = true
}

// The map is only drawn when someone presses "View map", never when the list loads
const showMap = ref(false)


const steps = ['Posted', 'Accepted', 'Done', 'Confirmed']
const stepNumbers = { open: 0, accepted: 1, pending_confirmation: 2, completed: 3 }
const currentStep = computed(() => stepNumbers[props.request.status])
const inProgress = computed(() => ['accepted', 'pending_confirmation'].includes(props.request.status))

const neededAtText = computed(() => formatNeededAt(props.request.neededAt))

// Whole days since it was posted
const DAY_MS = 24 * 60 * 60 * 1000
const waitingDays = computed(() => Math.floor((Date.now() - props.request.createdAt) / DAY_MS))
</script>

<template>
  <article class="card request-card"
    :class="[categoryClass(request.category), { 'is-expanded': expanded, 'is-compact': compact }]"
    @pointerenter="onEnter" @pointerleave="onLeave">
      
    <div class="card-body p-3 p-md-4">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center align-items-md-center gap-3">
        
        <div class="d-flex flex-column gap-2 flex-grow-1 min-w-0" style="min-width: 0;">
          
          <!-- category title -->
          <div class="d-flex flex-wrap align-items-center gap-2 text-center text-md-start justify-content-center justify-content-md-start">
            <CategoryBadge :category="request.category" :show-icon="false" />

            <!-- display on mobile -->
            <div v-if="categoryIcon" class="d-md-none my-2 text-center w-100">
              <img :src="categoryIcon" class="request-card-art mx-auto" alt="" />
            </div>

            <!-- status pill -->
            <StatusBadge v-if="!hideStatus" :status="request.status" :viewer="viewer" class="request-status-pill py-1 px-3" />
          </div>

          <!-- Main Text -->
          <div class="d-flex flex-column gap-1 text-start">
            <h2 class="request-title">
              <button type="button" class="request-toggle" :aria-expanded="expanded"
                @click="toggle">{{ request.title }}</button>
            </h2>

            <p v-if="compact" class="request-stats" data-testid="card-stats">
              <img src="/images/coin.svg" class="point-coin-img" alt="" />
              {{ request.points }} pts · {{ request.duration }} min · {{ request.difficulty }} effort
            </p>

            <p class="request-stats" data-testid="card-summary">
              <span data-testid="needed-at">{{ neededAtText }}</span>
              · <span data-testid="location">{{ request.location }}</span>
            </p>

            <p v-if="showWaiting && request.status === 'open' && waitingDays >= 2" class="request-waiting"
              data-testid="waiting">
              Waiting for a helper for {{ waitingDays }} days
            </p>

            <div v-if="$slots.notice" class="request-notice">
              <slot name="notice" />
            </div>

            <!-- Does the same as the title button. Hidden from screen readers:
                 the title button and its aria-expanded already say it -->
            <span v-if="!open" class="request-hint" aria-hidden="true" @click="toggle">{{ hint }}</span>
          </div>
        </div>

        <!--display on laptop scrren -->
        <div v-if="categoryIcon" class="d-none d-md-block flex-shrink-0 align-self-md-center" aria-hidden="true">
          <img :src="categoryIcon" class="request-card-art" alt="" />
        </div>
        
      </div>

      <!-- Only visible when the card is open -->
      <div class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ request.description }}</p>

          <div class="request-place">
            <span>Meeting place: <strong>{{ request.location }}</strong></span>
            <button type="button" class="btn btn-outline-primary" data-testid="view-map" @click="openMap">View
              map</button>
          </div>
          <!-- showRequester is false on the requester's own board, so it is their home -->
          <p v-if="request.atHome" class="mb-0" data-testid="at-home">
            {{ showRequester ? "At the requester's home" : 'At your home' }}
          </p>

          <!-- A compact card already shows these on the closed card -->
          <dl v-if="!compact" class="request-facts">
            <div>
              <dt>Time needed</dt>
              <dd>{{ request.duration }} minutes</dd>
            </div>
            <div>
              <dt>Effort</dt>
              <dd>{{ request.difficulty }}</dd>
            </div>
            <div>
              <dt>Reward</dt>
              <dd> <img src="/images/coin.svg" class="point-coin-img" alt="" />{{ request.points }} points</dd>
            </div>
          </dl>

          <p v-if="showRequester || (showHelper && request.helperName)" class="request-people">
            <span v-if="showRequester"><strong>{{ request.seniorName }}</strong></span>
            <span v-if="showHelper && request.helperName">Helper: <strong>{{ request.helperName }}</strong></span>
          </p>

          <ol v-if="inProgress" class="progress-steps" >
            <li v-for="(step, i) in steps" :key="step"
              :class="{ 'is-done': i <= currentStep, 'is-current': i === currentStep }">
              {{ step }}
            </li>
          </ol>

          <div class="request-actions">
            <slot name="actions" />
          </div>
        </div>
      </div>

    </div>

    <!-- Moved to <body>: inside the card it would sit under the other cards and be hidden when the card closes -->
    <Teleport to="body">
      <RequestMapModal v-if="showMap" :location="request.location" :latitude="request.latitude"
        :longitude="request.longitude" @close="showMap = false" />
    </Teleport>
  </article>
</template>

<style scoped>

.request-card {
  overflow: hidden;
}

.request-card:hover,
.request-card:focus-within {
  border-color: var(--ks-line-strong);
  border-left-color: var(--cat);
  box-shadow: 0 6px 18px rgba(10, 60, 60, 0.14);
}

.request-summary {
  margin: 0;
  font-weight: 600;
}

.request-waiting {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ks-muted);
}

.request-stats {
  margin: 0;
  font-weight: 700;
  color: var(--ks-heading);
}

.request-place {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

/* Compact Mode (Youth Help Board) */
.request-card.is-compact .card-body {
  gap: 0.35rem;
  padding: 0.9rem 1.25rem;
}

.request-card.is-compact .request-details-inner {
  gap: 0.75rem;
}

/* Notice / Urgent Alert Box */
.request-notice {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
  border: 2px solid #d3ad45;
  border-radius: 0.75rem;
  background: var(--ks-amber-bg);
  color: var(--ks-amber-ink);
  font-weight: 600;
}

.request-status-pill {
  max-width: 100%;
  white-space: normal;
  text-align: center;
  word-break: normal;
}

@media (min-width: 768px) {
  .request-status-pill {
    white-space: nowrap;
  }
}

@media (min-width: 992px) {
  .request-card-art {
    width: 7.5rem;
    height: 7.5rem;
  }
}

.request-card-art {
  width: 6rem;
  height: 6rem;
  border-radius: 1.25rem;
  object-fit: cover;
  image-rendering: pixelated;
  display: block;
  pointer-events: none;
}


</style>