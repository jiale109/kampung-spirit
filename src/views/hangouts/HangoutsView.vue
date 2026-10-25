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
import { loadForecast, weatherWarning } from '../../lib/weather.js'
import { sessionStart } from '../../lib/skillSwapFormat.js'
import EmptyState from '../../components/EmptyState.vue'
import HangoutCard from '../../components/HangoutCard.vue'
import HotspotMap from '../../components/HotspotMap.vue'

const store = useHangoutStore()

/*
  Two ways to narrow the list, and only one is ever on:
    selectedPlace  a place name, from pressing a marker on the map
    pickedPoint    a spot tapped on the map, or found with the search box;
                   hangouts within NEAR_KM of it are shown
  Choosing one clears the other, so the page never shows two filters at once.
*/
const selectedPlace = ref('')
const pickedPoint = ref(null)
const message = ref('')
const error = ref('')

// { 'Geylang': 'Partly Cloudy (Day)', ... }. Stays empty if the forecast
// cannot be read, which simply switches the warnings off.
const forecast = ref({ areas: [], byArea: {} })

// The map is only mounted once the hangouts are in, so every marker is known
// when it is built and none has to be added afterwards.
const ready = ref(false)

onMounted(async () => {
  await store.load()
  forecast.value = await loadForecast()
  ready.value = true
})

// Open hangouts at the chosen place, or all of them when nothing is chosen.
// weatherWarning is added here rather than in the store, because it comes
// from an outside API and the card only has to show it.
// Is the list narrowed at all? Decides which empty message to show.
const isFiltered = computed(() => selectedPlace.value !== '' || pickedPoint.value !== null)

/*
  What the person is filtering by, in words, for the empty message.
  A named place reads better ("no hangouts at Eunos Link Park"), and a spot
  tapped on the map has no name, so it falls back to plain words.
*/
const filterLabel = computed(
  () => selectedPlace.value || pickedPoint.value?.name || 'the searched location',
)

function pickPlace(place) {
  pickedPoint.value = null
  selectedPlace.value = place.name
}

function pickPoint(point) {
  selectedPlace.value = ''
  pickedPoint.value = { lat: point.lat, lng: point.lng, name: point.name ?? '' }
}

function clearFilter() {
  selectedPlace.value = ''
  pickedPoint.value = null
}

const shownHangouts = computed(() =>
  (pickedPoint.value ? store.nearPoint(pickedPoint.value) : store.atPlace(selectedPlace.value)).map((h) => ({
    ...h,
    weatherWarning: weatherWarning(h, forecast.value, sessionStart(h.date, h.time)),
  })),
)

/*
  The same list, split in two. Your own hangouts come first, because they are
  the ones you may have to cancel or mark as done, and they are the only ones
  with those buttons on them. Everyone else's follow underneath.

  Both halves are built from shownHangouts, so the place filter narrows them
  together and neither can drift out of step with the map.
*/
const myHangouts = computed(() => shownHangouts.value.filter((h) => store.isHost(h)))
const neighbourHangouts = computed(() => shownHangouts.value.filter((h) => !store.isHost(h)))

// One marker per place that has a hangout on it. Two hangouts at the same
// place only produce one marker.
const mapPlaces = computed(() => {
  const byName = new Map()
  for (const h of store.openHangouts) {
    const found = byName.get(h.placeName)
    if (found) {
      found.count += 1
      continue
    }
    byName.set(h.placeName, {
      name: h.placeName, latitude: h.latitude, longitude: h.longitude, count: 1,
    })
  }
  return [...byName.values()]
})

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

    <div v-if="ready" class="card mb-4">
      <div class="card-body p-4 vstack gap-3">
        <h2 class="page-title fs-4">Where we meet</h2>
        <p class="page-subtitle mb-0">
          Search for a place, or tap anywhere on the map to look for a hangout spot.
        </p>
        <HotspotMap :places="mapPlaces" pickable label="Find a place"
          @marker="pickPlace" @select="pickPoint" @pick="pickPoint" />
        <div v-if="isFiltered">
          <button type="button" class="btn btn-outline-secondary" data-testid="clear-filter"
            @click="clearFilter">Show all places</button>
        </div>
      </div>
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="store.loadError" class="alert alert-danger" role="alert">{{ store.loadError }}</div>

    <p v-if="store.loading && store.hangouts.length === 0">Loading hangouts...</p>

    <!-- Nothing matched the place being filtered by -->
    <EmptyState v-if="shownHangouts.length === 0 && isFiltered"
      :message="`Sorry, there are no hangouts at ${filterLabel}.`" data-testid="no-hangouts-here">
      <div class="d-grid gap-3 d-sm-flex justify-content-sm-center mt-4">
        <router-link to="/app/hangouts/new" class="btn btn-primary btn-lg"
          data-testid="propose-instead">Propose a hangout instead</router-link>
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="clearFilter">
          Show all places
        </button>
      </div>
    </EmptyState>

    <!-- Nothing anywhere yet -->
    <EmptyState v-else-if="shownHangouts.length === 0"
      message="No hangouts here yet. Why not propose one for your neighbours?">
      <router-link to="/app/hangouts/new" class="btn btn-primary btn-lg mt-4">Propose a hangout</router-link>
    </EmptyState>

    <!-- Yours first, then everyone else's. A heading only appears when that
         half has something in it, so nobody is shown an empty box. -->
    <template v-else>
      <section v-if="myHangouts.length > 0" class="mb-5" data-testid="my-hangouts">
        <h2 class="page-title fs-4 mb-3">
          Hangouts you are hosting
          <span class="page-subtitle">({{ myHangouts.length }})</span>
        </h2>
        <div class="request-list">
          <HangoutCard v-for="hangout in myHangouts" :key="hangout.id" :hangout="hangout"
            @join="join" @leave="leave" @cancel="cancel" @complete="complete" />
        </div>
      </section>

      <section v-if="neighbourHangouts.length > 0" data-testid="neighbour-hangouts">
        <h2 class="page-title fs-4 mb-3">
          Hangouts from your neighbours
          <span class="page-subtitle">({{ neighbourHangouts.length }})</span>
        </h2>
        <div class="request-list">
          <HangoutCard v-for="hangout in neighbourHangouts" :key="hangout.id" :hangout="hangout"
            @join="join" @leave="leave" @cancel="cancel" @complete="complete" />
        </div>
      </section>

      <!-- You are hosting every hangout on the list. Said plainly, so the
           page does not look as though your neighbours' ones failed to load. -->
      <p v-if="neighbourHangouts.length === 0" class="page-subtitle mt-4"
        data-testid="no-neighbour-hangouts">
        Nobody else has proposed a hangout yet.
      </p>
    </template>
  </div>
</template>
