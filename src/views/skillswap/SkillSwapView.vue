<script setup>
/*
  ============================================================================
  GUIDE: Skill-Swap Circles                                Owner: Kelsey Wong
  ============================================================================
  Route: /app/skill-swaps (host one at /app/skill-swaps/new, SkillSwapCreateView.vue).
  Seniors and youths host small sessions and others take a place until the
  session is full. This page has tabs (all / hosting / going), search,
  filters and sort.

  Uses: stores/skillSwap.js (rules repeated from supabase/schema.sql section
  8), lib/skillSwapFormat.js (formatting, CATEGORIES, option lists),
  components/SkillSwapCard.vue and SkillSwapForm.vue. Completing a session
  pays points in complete_skill_session() in the database.

  STILL LEFT: onCancel uses window.confirm(); a modal like the one in
  views/senior/SeniorHelpBoardView.vue is easier for seniors to read. The
  counts in categoryOptions are worked out but not shown. The e2e test only
  covers hosting, not joining, a full session or cancelling.
*/

import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import SkillSwapCard from '../../components/SkillSwapCard.vue'
import HotspotMap from '../../components/HotspotMap.vue'
import { NEAR_KM, isNearPoint, countWithoutPin, placeMarkers } from '../../lib/nearby.js'
import { useSkillSwapStore } from '../../stores/skillSwap.js'
import {
  formatDate,
  dateFromToday,
  isWeekend,
  CATEGORIES,
  SORT_OPTIONS,
  WHEN_FILTERS,
} from '../../lib/skillSwapFormat.js'

const route = useRoute()
const store = useSkillSwapStore()

//selected filter
const filter = ref('all') // all | hosting | going
const query = ref('')
const sortBy = ref('date-asc')
const selectedCategory = ref('') // e.g. ['Tech', 'Crafts']
const whenFilter = ref('any') // any | week | weekend
const onlyOpen = ref(false) // only sessions with spots left

/*
  Narrowing to one place, the same two ways as the Hangouts page:
    selectedPlace  a venue name, from pressing a marker
    pickedPoint    a spot searched for or tapped; anything within NEAR_KM of
                   it counts
  Choosing one clears the other, so there is never more than one place filter.
*/
const selectedPlace = ref('')
const pickedPoint = ref(null)

// The map is drawn once the sessions are in, so every marker is known when
// it is built and none has to be added afterwards
const mapReady = ref(false)
const notice = ref(null) // { kind: 'ok' | 'error', text }

//to allow user to filter all events, going, hosting 
const tabs = [
    {key:'all' , label: 'ALL Sessions'},
    {key:'hosting' , label: 'Sessions I am hosting'},
    {key:'going' , label: 'Sessions I am attending'}
]

const baseList = computed (() => {
    if (filter.value === 'hosting') {
        return store.mySessions
    }
    if (filter.value === 'going') {
        return store.myRsvps
    }
    return store.openSessions
})

/*
  The filter list: the seven suggestions, plus anything hosts have typed in
  that is not one of them.

  Without the second half a session called "Mahjong" could be created and
  then never filtered for, because the list only knew the fixed seven.
*/
const categoryOptions = computed(() => {
    const inUse = [...new Set(store.openSessions.map((s) => s.category))]
    const extras = inUse.filter((name) => name && !CATEGORIES.includes(name)).sort()
    return [...CATEGORIES, ...extras].map((name) => ({
        name,
        count: store.openSessions.filter((s) => s.category === name).length,
    }))
})

// --- search + filters ---
const words = computed (() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))
//search function
function matchesSearch(s) {
    const text = [
        s.title, 
        s.description, 
        s.hostName, 
        s.venue, 
        s.category,
        formatDate(s.date),
  
    ].join(' ').toLowerCase()
    return words.value.every((w) => text.includes(w))
}
/*
  Pressing a marker matches the venue NAME; searching or tapping matches
  anything within NEAR_KM of the point. A session with no pin (saved before
  the map was added) cannot honestly be called near anywhere, so it drops out
  while a place filter is on - the banner says how many.
*/
function passesPlace(s) {
    if (selectedPlace.value !== '') return s.venue === selectedPlace.value
    return isNearPoint(s, pickedPoint.value)
}

//filter function
function passesFilters(s) {
    if (!passesPlace(s)) return false
    if (selectedCategory.value && s.category !== selectedCategory.value) return false
    if (whenFilter.value === 'week' && s.date > dateFromToday(7)) return false 
    if (whenFilter.value === 'weekend' && !isWeekend(s.date)) return false 
    if (onlyOpen.value && store.spotsLeft(s) <= 0 && !store.isHost(s) && !store.isAttending(s)) return false //basically if u hosted/joined the session, even if it's full it still display

    return true 
}

// --- sort ---
const startOf = (s) => `${s.date} ${s.time}`
const comparators = {
  'date-asc': (a, b) => startOf(a).localeCompare(startOf(b)), //earliest date first 
  'date-desc': (a, b) => startOf(b).localeCompare(startOf(a)), //latest date first 
  'dur-asc': (a, b) => a.duration - b.duration, //shortest dur first
  'dur-desc': (a, b) => b.duration - a.duration, //longest dur first 
  'spots-desc': (a, b) => store.spotsLeft(b) - store.spotsLeft(a), //most spots left first 
  'spots-asc': (a, b) => store.spotsLeft(a) - store.spotsLeft(b), //fewest spots left first 
}
 
const shown = computed(() =>
  baseList.value
    .filter((s) => passesFilters(s) && (!words.value.length || matchesSearch(s)))
    .sort(comparators[sortBy.value]),
)

//other helpers for display screen 
function clearFilters() {
  selectedCategory.value = ''
  clearPlaceFilter()

  whenFilter.value = 'any'
  onlyOpen.value = false
}

const isPlaceFiltered = computed(() => selectedPlace.value !== '' || pickedPoint.value !== null)

const placeNote = computed(() => {
  if (selectedPlace.value !== '') return `at ${selectedPlace.value}`
  const name = pickedPoint.value?.name
  return `within ${NEAR_KM} km of ${name || 'the spot you chose'}`
})

// One marker per venue that has a session on it, with a count in the popup
const mapPlaces = computed(() => placeMarkers(store.openSessions, 'venue'))

const hiddenWithoutPin = computed(() =>
  isPlaceFiltered.value ? countWithoutPin(store.openSessions) : 0,
)

function pickPlace(place) {
  pickedPoint.value = null
  selectedPlace.value = place.name
}

function pickPoint(point) {
  selectedPlace.value = ''
  pickedPoint.value = { lat: point.lat, lng: point.lng, name: point.name ?? '' }
}

function clearPlaceFilter() {
  selectedPlace.value = ''
  pickedPoint.value = null
}

const activeFilterCount = computed(
  () =>
    (isPlaceFiltered.value ? 1 : 0) +
    (selectedCategory.value ? 1 : 0) +
    (whenFilter.value !== 'any' ? 1 : 0) +
    (onlyOpen.value ? 1 : 0),
)

const isNarrowed = computed(() => words.value.length > 0 || activeFilterCount.value > 0)

//no. of filtered sessions found 
const countText = computed(() => {
  const n = shown.value.length
  const label = n === 1 ? '1 session' : `${n} sessions`
  return `${label}${isNarrowed.value ? ' found' : ''}`
})

const emptyMessage = computed(() => {
  if (isPlaceFiltered.value) return `Sorry, there are no sessions ${placeNote.value}.`
  if (isNarrowed.value) return 'No sessions match. Try fewer filters or a shorter search.'
  if (filter.value === 'hosting') return 'You are not hosting a session yet.'
  if (filter.value === 'going') return 'You have not joined a session yet.'
  return 'No sessions yet. Be the first to host one.'
})


//---session hosting form---
const createPath = computed(() => `${route.path.replace(/\/$/, '')}/new`)

function pick(key) {
  filter.value = key
  notice.value = null
}
 
function report(result, okText) {
  notice.value = result.ok
    ? { kind: 'ok', text: okText }
    : { kind: 'error', text: result.error }
}

//---database calls---
const busy = ref(false)
 
async function act(call, okText) {
  if (busy.value) return
  busy.value = true
  report(await call(), okText)
  busy.value = false
}
 
const onJoin = (s) => act(() => store.rsvp(s.id), `You have a place in “${s.title}”.`)
const onLeave = (s) => act(() => store.cancelRsvp(s.id), `Your place in “${s.title}” is cancelled.`)
 
function onCancel(s) {
  if (!window.confirm(`Cancel “${s.title}”? People who joined will lose their place.`)) return
  return act(() => store.cancelSession(s.id), `“${s.title}” is cancelled.`)
}
 
async function onComplete(s) {
  if (busy.value) return
  busy.value = true
  const result = await store.completeSession(s.id)
  report(
    result,
    `“${s.title}” is marked as completed. Everyone who took part earns ${result.points} points.`,
  )
  busy.value = false
}
 
onMounted(() => {
  // Arriving from the host form after sharing a session.
  if (route.query.created) {
    notice.value = { kind: 'ok', text: 'Your session is shared. Neighbours can now join it.' }
  }
  store.load().then(() => {
    mapReady.value = true
  })
})
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Skill Swaps</h1>
        <p class="page-subtitle">Small sessions where neighbours teach each other.</p>
      </div>
      <RouterLink :to="createPath" class="btn btn-primary btn-lg">Host a session</RouterLink>
    </div>

    <!--all | hosting | going-->
    <div class="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Show sessions">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="btn"
        :class="filter === t.key ? 'btn-primary' : 'btn-outline-secondary'"
        :aria-pressed="filter === t.key"
        @click="pick(t.key)"
      >
        {{ t.label }}
      </button>
    </div>
    <div v-if="mapReady" class="card mb-4">
      <div class="card-body p-4 vstack gap-3">
        <h2 class="page-title fs-4">Where sessions are held</h2>
        <p class="page-subtitle mb-0">
          Search for a place, or tap anywhere on the map to find sessions near it.
        </p>
        <HotspotMap :places="mapPlaces" pickable label="Find a place"
          @marker="pickPlace" @select="pickPoint" @pick="pickPoint" />
      </div>
    </div>

    <!-- What the list has been narrowed to. The map panning away hides the
         button under it, so the filter is named again here. -->
    <div v-if="isPlaceFiltered" class="filter-banner d-flex flex-wrap align-items-center
      justify-content-between gap-3 mb-4" role="status" data-testid="place-filter-banner">
      <span>
        Showing <strong>{{ shown.length }}</strong>
        {{ shown.length === 1 ? 'session' : 'sessions' }}
        {{ placeNote }}.
        <template v-if="hiddenWithoutPin > 0">
          <br />
          {{ hiddenWithoutPin }} older
          {{ hiddenWithoutPin === 1 ? 'session has' : 'sessions have' }}
          no place on the map, so {{ hiddenWithoutPin === 1 ? 'it is' : 'they are' }} not shown.
        </template>
      </span>
      <button type="button" class="btn btn-outline-secondary flex-shrink-0"
        data-testid="clear-place-filter" @click="clearPlaceFilter">Show all places</button>
    </div>

    <!--search | filter | sort-->
    <div class="row g-3 mb-3">
      <div class="col-12">
        <label for="swap-search" class="form-label">Search sessions</label>
        <div class="input-group">
          <input
            id="swap-search"
            v-model="query"
            type="text"
            class="form-control"
            placeholder="Search by topic, host or day"
            autocomplete="off"
          />
          <button v-if="query" type="button" class="btn btn-outline-secondary" @click="query = ''">Clear</button>
        </div>
      </div>
 
      <div class="col-sm-4">
        <label for="swap-category" class="form-label">Type of session</label>
        <select id="swap-category" v-model="selectedCategory" class="form-select">
          <option value="">All types</option>
          <option v-for="c in categoryOptions" :key="c.name" :value="c.name">
            {{ c.name }} 
          </option>
        </select>
      </div>
      <div class="col-sm-4">
        <label for="swap-when" class="form-label">When</label>
        <select id="swap-when" v-model="whenFilter" class="form-select">
          <option v-for="o in WHEN_FILTERS" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
      </div>
 
      <div class="col-sm-4">
        <label for="swap-sort" class="form-label">Sort by</label>
        <select id="swap-sort" v-model="sortBy" class="form-select">
          <option v-for="o in SORT_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
      </div>
      <div class="col-12">
        <div class="form-check mb-2">
          <input id="only-open" v-model="onlyOpen" type="checkbox" class="form-check-input" />
          <label for="only-open" class="form-check-label">Only sessions with spots left</label>
        </div>
      </div>
    </div>
 
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <span class="count-pill" role="status" data-testid="session-count">{{ countText }}</span>
      <button v-if="activeFilterCount" type="button" class="btn btn-outline-secondary" @click="clearFilters">
        Clear filters ({{ activeFilterCount }})
      </button>
    </div>
 
    <div
      v-if="notice"
      class="alert"
      :class="notice.kind === 'ok' ? 'alert-success' : 'alert-danger'"
      :role="notice.kind === 'error' ? 'alert' : 'status'"
    >
      {{ notice.text }}
    </div>
 
    <div v-if="store.loadError" class="alert alert-danger d-flex flex-wrap align-items-center gap-3" role="alert">
      <span>{{ store.loadError }}</span>
      <button type="button" class="btn btn-outline-secondary" @click="store.load()">Try again</button>
    </div>
 
    <EmptyState v-if="store.loading && store.sessions.length === 0" message="Loading sessions…" />
    <EmptyState v-else-if="shown.length === 0 && !store.loadError" :message="emptyMessage" />
 
    <div v-else-if="shown.length" class="request-list">
      <SkillSwapCard
        v-for="s in shown"
        :key="s.id"
        :session="s"
        @join="onJoin"
        @leave="onLeave"
        @cancel="onCancel"
        @complete="onComplete"
      />
    </div>
 
    <p class="points-note mt-4">
      Hosting or joining a session earns you points once the host marks it as completed.
    </p>
  </div>

</template>

