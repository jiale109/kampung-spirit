<script setup>
import { ref, computed, useId } from 'vue'
import CategoryBadge from './CategoryBadge.vue'
import StatusBadge from './StatusBadge.vue'
import { categoryClass } from '../lib/points.js'

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

// ---- Simple by default, details on demand ----
// A closed card shows only the category, the status and the title.
// It opens when the mouse is over it (hovering), or when it is tapped or
// activated with the keyboard (pinned). Tapping again closes it.
const hovering = ref(false)
const pinned = ref(false)
const expanded = computed(() => props.open || hovering.value || pinned.value)

// Links the title button to the details it shows (for screen readers)
const detailsId = useId()

// The progress line shown while a task is being done
const steps = ['Posted', 'Accepted', 'Done', 'Confirmed']
const stepNumbers = { open: 0, accepted: 1, pending_confirmation: 2, completed: 3 }
const currentStep = computed(() => stepNumbers[props.request.status])
const inProgress = computed(() => ['accepted', 'pending_confirmation'].includes(props.request.status))
</script>

<template>
  <article class="card request-card" :class="[categoryClass(request.category), { 'is-expanded': expanded }]"
    @mouseenter="hovering = true" @mouseleave="hovering = false">
    <div class="card-body">

      <!-- Always visible -->
      <div class="request-top">
        <CategoryBadge :category="request.category" />
        <StatusBadge v-if="!hideStatus" :status="request.status" />
      </div>

      <h2 class="request-title">
        <!-- The button is stretched over the whole card (see theme.css), so the whole card can be tapped -->
        <button type="button" class="request-toggle" :aria-expanded="expanded" :aria-controls="detailsId"
          @click="pinned = !pinned">{{ request.title }}</button>
      </h2>
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

          <!-- Progress (only while in progress) -->
          <ol v-if="inProgress" class="progress-steps" aria-label="Progress">
            <li v-for="(step, i) in steps" :key="step"
              :class="{ 'is-done': i <= currentStep, 'is-current': i === currentStep }"
              :aria-current="i === currentStep ? 'step' : undefined">
              {{ step }}
            </li>
          </ol>

          <!-- Buttons are filled in by each page -->
          <div class="request-actions">
            <slot name="actions" />
          </div>
        </div>
      </div>

    </div>
  </article>
</template>
