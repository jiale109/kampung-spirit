<script setup>
/*
  ============================================================================
  GUIDE: Skill-Swap Circles                                Owner: Kelsey Wong
  ============================================================================
  STATUS: list page and store built (Supabase). The host form and the
  database tables are not in the repo yet.

  Route: /app/skill-swaps (in sharedChildren in router/index.js).

  WHAT THE PROPOSAL SAYS
  Seniors and youths host small sessions to share what they know: a youth
  might teach digital banking safety or mobile photography, a senior might
  teach crochet or traditional cooking. Hosts set a date, time, duration and
  capacity, and others RSVP until the session is full. Because both
  generations can teach, seniors become contributors and not just recipients
  of help.

  WHAT EXISTS ALREADY
  - stores/skillSwap.js: load(), openSessions, mySessions (hosting),
    myRsvps (attending), spotsLeft(), isHost(), isAttending(), and the
    actions createSession(), rsvp(), cancelRsvp(), cancelSession(),
    completeSession(). Each returns { ok, error }.
  - lib/skillSwapFormat.js: date/time/duration formatting, CATEGORIES,
    SORT_OPTIONS, WHEN_FILTERS and the option lists for the host form
    (DURATION_OPTIONS, TIME_OPTIONS, dateOptions(), CAPACITY_OPTIONS).
  - components/SkillSwapCard.vue: one session (details on hover or tap).
  - This page: tabs (all / hosting / going), search, filters and sort.

  WHAT IS LEFT TO DO (in this order)

  1. Fix SkillSwapCard.vue: the template calls categoryIcon(), which is not
     defined or imported, so the page breaks as soon as a session is shown.

  2. Database (add a new numbered section to supabase/schema.sql)
     The store already uses these names, but they are not in schema.sql:
       skill_sessions (id, host_id default auth.uid(), title, description,
         category, venue, session_date, session_time, duration, capacity,
         status 'open' | 'completed' | 'cancelled', created_at)
       skill_session_attendees (session id, user_id)
       functions: join_skill_session(swap_id), leave_skill_session(swap_id),
         cancel_skill_session(swap_id), complete_skill_session(swap_id)
     If they were made in the Supabase dashboard, copy the SQL into
     schema.sql so teammates' projects match. Like help_requests: enable RLS,
     add policies AND grant lines (section 6), and re-check the rules in the
     functions (host cannot join their own session, capacity is never
     exceeded, only the host can cancel or complete).
     Add a few sample sessions with SQL inserts, including one that is full.

  3. Host a session (components/SkillSwapForm.vue, new)
     Model it on components/RequestForm.vue: a form ref, an errors ref, and
     validation on submit. Fields: title, description, category, venue, date,
     time, duration, capacity (use the option lists in lib/skillSwapFormat.js).
     createSession() already checks: title at least 5 letters, date not in
     the past, capacity 1 to 10. Put it on views/skillswap/SkillSwapCreateView.vue
     and add ONE line to sharedChildren in router/index.js:
       { path: 'skill-swaps/new', component: SkillSwapCreateView }
     The "Host a session" button already links to /app/skill-swaps/new. After
     saving, go back with ?created=1 so this page shows the success message.

  4. Small fixes on this page
     - hostType is used by the search and hostFilter but never set. Either
       add it in fromRow() (from the host's age_group) or remove it.
     - showFilters and the counts in categoryOptions are not shown yet.
     - onCancel uses window.confirm(); a modal like the one in
       views/senior/SeniorHelpBoardView.vue is easier for seniors to read.

  5. Points
     Hosting and attending a completed session earns points. Points can only
     be added by database functions, so complete_skill_session() must insert
     the points_ledger rows itself, using the same rule as pointsForSkillSwap()
     in lib/points.js. After completing, call usePointsStore().load() so the
     navbar shows the new total.

  6. Tests (e2e/skillswap.spec.js, copy the style of e2e/helpboard.spec.js)
     Host a session, RSVP until full, the full state blocks the next RSVP, and
     cancelling a place frees a spot.

  SENIOR-FRIENDLY RULES (also in README.md and CONTRIBUTING.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Date and time pickers are hard for some
  seniors: use <select> lists for time (e.g. every 30 minutes) and show
  the date as words ("Saturday, 17 October") on the cards.
  Check your layout at 22px text and on a phone.
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

