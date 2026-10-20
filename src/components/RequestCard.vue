<script setup>
import { ref, computed, useId } from 'vue'
import CategoryBadge from './CategoryBadge.vue'
import StatusBadge from './StatusBadge.vue'
import { categoryClass } from '../lib/points.js'
import { formatNeededAt } from '../stores/helpRequest.js'

const props = defineProps({
  request: { type: Object, required: true },
  // The senior's own board already knows who is asking, so it hides the name
  showRequester: { type: Boolean, default: true },
  // A youth's own task list already knows who the helper is (themselves)
  showHelper: { type: Boolean, default: true },
  // On the youth Help Board every request is "Open", so the badge adds nothing
  hideStatus: { type: Boolean, default: false },
  // Keep the card open, for example when the senior has something to confirm
  open: { type: Boolean, default: false },
})


const pinned = ref(false)
const expanded = computed(() => props.open || pinned.value)

const detailsId = useId()


const steps = ['Posted', 'Accepted', 'Done', 'Confirmed']
const stepNumbers = { open: 0, accepted: 1, pending_confirmation: 2, completed: 3 }
const currentStep = computed(() => stepNumbers[props.request.status])
const inProgress = computed(() => ['accepted', 'pending_confirmation'].includes(props.request.status))

const neededAtText = computed(() => formatNeededAt(props.request.neededAt))
</script>

<template>
  <article class="card request-card" :class="[categoryClass(request.category), { 'is-expanded': expanded }]">
    <div class="card-body">

      <!-- Always visible -->
      <div class="request-top">
        <CategoryBadge :category="request.category" />
        <StatusBadge v-if="!hideStatus" :status="request.status" />
      </div>

      <h2 class="request-title">
        <button type="button" class="request-toggle" :aria-expanded="expanded" :aria-controls="detailsId"
          @click="pinned = !pinned">{{ request.title }}</button>
      </h2>

      <p class="request-summary" data-testid="card-summary">
        <span data-testid="needed-at">{{ neededAtText }}</span>
        <span v-if="showRequester && request.block"> · {{ request.block }}</span>
      </p>

      <div v-if="$slots.notice" class="request-notice">
        <slot name="notice" />
      </div>
      <span v-if="!open" class="request-hint" aria-hidden="true">{{ expanded ? 'Hide details ▴' : 'Show details ▾' }}</span>

      <!-- Only visible when the card is open -->
      <div :id="detailsId" class="request-details">
        <div class="request-details-inner">
          <p class="request-desc">{{ request.description }}</p>

          <dl class="request-facts">
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
              <dd>⭐ {{ request.points }} points</dd>
            </div>
          </dl>

          <p v-if="showRequester || (showHelper && request.helperName)" class="request-people">
            <span v-if="showRequester"><strong>{{ request.seniorName }}</strong>, {{ request.block }}</span>
            <span v-if="showHelper && request.helperName">Helper: <strong>{{ request.helperName }}</strong></span>
          </p>

          <ol v-if="inProgress" class="progress-steps" aria-label="Progress">
            <li v-for="(step, i) in steps" :key="step"
              :class="{ 'is-done': i <= currentStep, 'is-current': i === currentStep }"
              :aria-current="i === currentStep ? 'step' : undefined">
              {{ step }}
            </li>
          </ol>

          <div class="request-actions">
            <slot name="actions" />
          </div>
        </div>
      </div>

    </div>
  </article>
</template>

<style scoped>

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

/* Sits above the stretched title button, so its buttons can be pressed */
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
</style>
