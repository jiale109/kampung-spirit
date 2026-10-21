<script setup>
/*
  ============================================================================
  GUIDE: Skill-Swap Circles                                Owner: Kelsey Wong
  ============================================================================
  This page is a PLACEHOLDER. Replace the template with the real feature.

  Route:  /app/skill-swaps and /app/skill-swaps (same page for both
          roles, see sharedChildren in router/index.js).

  WHAT THE PROPOSAL SAYS
  Seniors and youths host small sessions to share what they know: a youth
  might teach digital banking safety or mobile photography, a senior might
  teach crochet or traditional cooking. Hosts set a date, time, duration and
  capacity, and others RSVP until the session is full. Because both
  generations can teach, seniors become contributors and not just recipients
  of help.

  STEP BY STEP (build in this order, each step works on its own)

  1. Sample data (src/lib/seed.js)
     Add seedSessions() next to seedRequests(). A session could look like:
       { id, title, description, hostId, hostName, date: '2026-10-20',
         time: '15:00', duration: 60, capacity: 6, attendeeIds: [],
         status: 'open', createdAt: Date.now() }
     Include one session that is already full, to test the full state.
     Status flow: open > completed (or cancelled).

  2. Store (src/stores/skillSwap.js, new file)
     Copy the pattern of stores/helpRequest.js: a setup store, a ref loaded
     from localStorage (use a NEW storage key) and a watch() that saves it.
     Actions (return { ok, error } for anything that can fail):
       createSession(data)        host a session
       rsvp(id)                   fails with a clear message if full or already joined
       cancelRsvp(id)
       cancelSession(id)          host only
       completeSession(id)        host only, this is when points are awarded
     Computeds: spotsLeft(session), mySessions (hosting) and myRsvps (attending).
     Rules: the host cannot RSVP to their own session; capacity is never exceeded.

  3. Host a session (components/SkillSwapForm.vue, new)
     Model it on components/RequestForm.vue: a form ref, an errors ref, and
     validation on submit. Fields: title, description, date, time, duration
     (use a <select>, like durations in lib/points.js), capacity (1 to 10).
     Validation ideas: date cannot be in the past, capacity must be a whole
     number, title at least 5 characters. Give it its own page, e.g.
     views/skillswap/SkillSwapCreateView.vue, and add the route to
     sharedChildren in router/index.js.

  4. Session list and RSVP
     Show sessions as cards. Reuse the idea in components/RequestCard.vue
     (title always visible, details on hover or tap). The RSVP button turns
     into "Cancel my place" once joined, and into a disabled "Session full"
     when there are no spots left (write the reason as text, not only colour).

  5. Points
     Hosting and attending a completed session earns points. Do not write
     points yourself: agree with the Rewards owner on one function, e.g.
     awardPoints(userId, amount, reason).

  6. Tests (e2e/skillswap.spec.js, copy the style of e2e/helpboard.spec.js)
     Host a session, RSVP until full, the full state blocks the next RSVP, and
     cancelling a place frees a spot.

  SENIOR-FRIENDLY RULES (also in README.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Date and time pickers are hard for some
  seniors: consider <select> lists for time (e.g. every 30 minutes) and show
  the date as words ("Saturday, 17 October") on the cards.
  Senior pages are already 22px text, so check your layout at that size.
*/

import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import SkillSwapCard from '../../components/SkillSwapCard.vue'
import { useSkillSwapStore } from '../../stores/skillSwap'
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
const hostFilter = ref('any') // any | senior | youth
const whenFilter = ref('any') // any | week | weekend
const onlyOpen = ref(false) // only sessions with spots left
const showFilters = ref(false) // phones: filters are hidden until "Filters" is pressed
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

// --- displays the available categories + available no. of sessions ---
const categoryOptions = computed (() => 
    CATEGORIES.map((name) => ({
        name,
        count: store.openSessions.filter((s) => s.category === name).length, 
    }))
)

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
        `${s.hostType} host`,
    ].join(' ').toLowerCase()
    return words.value.every((w) => text.includes(w))
}
//filter function
function passesFilters(s) {
    if (selectedCategory.value && s.category !== selectedCategory.value) return false
    if (hostFilter.value !== 'any' && s.hostType !== hostFilter.value) return false 
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
  hostFilter.value = 'any'
  whenFilter.value = 'any'
  onlyOpen.value = false
}

const activeFilterCount = computed(
  () =>
    (selectedCategory.value ? 1 : 0) +
    (hostFilter.value !== 'any' ? 1 : 0) +
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
  store.load()
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
 
      <div class="col-sm-6">
        <label for="swap-category" class="form-label">Type of session</label>
        <select id="swap-category" v-model="selectedCategory" class="form-select">
          <option value="">All types</option>
          <option v-for="c in categoryOptions" :key="c.name" :value="c.name">
            {{ c.name }} 
          </option>
        </select>
      </div>
      <div class="col-sm-6">
        <label for="swap-when" class="form-label">When</label>
        <select id="swap-when" v-model="whenFilter" class="form-select">
          <option v-for="o in WHEN_FILTERS" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
      </div>
 
      <div class="col-sm-6">
        <label for="swap-sort" class="form-label">Sort by</label>
        <select id="swap-sort" v-model="sortBy" class="form-select">
          <option v-for="o in SORT_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
      </div>
      <div class="col-sm-6 d-flex align-items-end">
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

