<script setup>
/*
  ============================================================================
  GUIDE: Hotspot Hangouts                                Owner: Lee Jia Le
  ============================================================================
  Route: /app/hangouts (propose one at /app/hangouts/new, HangoutCreateView.vue).
  Residents propose casual hangouts at estate hotspots and others join. The
  page shows open hangouts (filter by hotspot), a OneMap map of the hotspots
  and, for outdoor hotspots starting within 2 hours, a rain warning.

  Uses: stores/hangout.js (rules repeated from supabase/schema.sql sections 7
  and 9), lib/hotspots.js, lib/weather.js (data.gov.sg forecast; no warning if
  it fails), components/HangoutCard.vue, HangoutForm.vue and HotspotMap.vue.
  Completing a hangout pays points in complete_hangout() in the database.

  STILL LEFT: hangouts cannot be edited after they are proposed, and there is
  no e2e test for cancelling or completing one.
*/
import { ref, computed, onMounted } from 'vue'
import { useHangoutStore } from '../../stores/hangout.js'
import { hotspots, findHotspot } from '../../lib/hotspots.js'
import { loadForecasts, weatherWarning } from '../../lib/weather.js'
import { sessionStart } from '../../lib/skillSwapFormat.js'
import EmptyState from '../../components/EmptyState.vue'
import HangoutCard from '../../components/HangoutCard.vue'
import HotspotMap from '../../components/HotspotMap.vue'

const store = useHangoutStore()

const selectedHotspot = ref('')
const message = ref('')
const error = ref('')

// { 'Geylang': 'Partly Cloudy (Day)', ... }. Stays empty if the forecast
// cannot be read, which simply switches the warnings off.
const forecasts = ref({})

onMounted(async () => {
  await store.load()
  forecasts.value = await loadForecasts()
})

// Open hangouts at the chosen place, or all of them when nothing is chosen.
// weatherWarning is added here rather than in the store, because it comes
// from an outside API and the card only has to show it.
const shownHangouts = computed(() =>
  store.atHotspot(selectedHotspot.value).map((h) => ({
    ...h,
    weatherWarning: weatherWarning(findHotspot(h.hotspotId), forecasts.value, sessionStart(h.date, h.time)),
  })),
)

async function join(hangout) {
  message.value = ''
  error.value = ''
  const result = await store.joinHangout(hangout.id)
  if (result.ok) message.value = `You are going to "${hangout.title}". See you there!`
  else error.value = result.error
}

async function leave(hangout) {
  message.value = ''
  error.value = ''
  const result = await store.leaveHangout(hangout.id)
  if (result.ok) message.value = `You are no longer going to "${hangout.title}".`
  else error.value = result.error
}

async function cancel(hangout) {
  message.value = ''
  error.value = ''
  if (!window.confirm(`Cancel "${hangout.title}"? Everyone going will no longer see it.`)) return
  const result = await store.cancelHangout(hangout.id)
  if (!result.ok) error.value = result.error
}

async function complete(hangout) {
  message.value = ''
  error.value = ''
  const result = await store.completeHangout(hangout.id)
  if (result.ok) message.value = `Thank you! Everyone who came to "${hangout.title}" has earned points.`
  else error.value = result.error
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Hangouts</h1>
        <p class="page-subtitle">Casual meet-ups at your estate's favourite spots.</p>
      </div>
      <router-link v-if="store.openHangouts.length > 0" to="/app/hangouts/new"
        class="btn btn-primary btn-lg">Propose a hangout</router-link>
    </div>

    <HotspotMap />

    <!-- Filter by place (not a .card, so it is not mistaken for a hangout) -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6">
        <label for="hotspot-filter" class="form-label">Filter by place</label>
        <select id="hotspot-filter" v-model="selectedHotspot" class="form-select" data-testid="hotspot-filter">
          <option value="">All places</option>
          <option v-for="h in hotspots" :key="h.id" :value="h.id">{{ h.name }}</option>
        </select>
      </div>
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="store.loadError" class="alert alert-danger" role="alert">{{ store.loadError }}</div>

    <p v-if="store.loading && store.hangouts.length === 0">Loading hangouts...</p>

    <EmptyState v-if="shownHangouts.length === 0"
      message="No hangouts here yet. Why not propose one for your neighbours?">
      <router-link to="/app/hangouts/new" class="btn btn-primary btn-lg mt-4">Propose a hangout</router-link>
    </EmptyState>

    <div v-else class="request-list">
      <HangoutCard v-for="hangout in shownHangouts" :key="hangout.id" :hangout="hangout"
        @join="join" @leave="leave" @cancel="cancel" @complete="complete" />
    </div>
  </div>
</template>
