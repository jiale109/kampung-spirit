<script setup>
/*
  ============================================================================
  GUIDE: Hotspot Hangouts                                Owner: Lee Jia Le
  ============================================================================
  STATUS: PLACEHOLDER. Replace the template with the real feature.

  Route: /app/hangouts (one page for everyone, listed in sharedChildren in
  router/index.js, linked from layouts/MainLayout.vue).

  WHAT THE PROPOSAL SAYS
  Residents propose casual, low-pressure hangouts (morning walks, kopi and
  newspaper chats, herb-garden sessions) at familiar estate hotspots (the CC,
  the market, the garden). Others browse hangouts by hotspot and join.
  Hotspots appear on a map using the OneMap API. Outdoor hangouts show the
  data.gov.sg 2-hour weather forecast, so residents are warned if rain is
  expected. Attending or hosting earns points.

  WHAT EXISTS ALREADY
  - Login is real (Supabase Auth). useAuthStore().user is
    { id, name, block, interests, large_text, age_group, guardian_status }.
    There is no "role": anyone can host or join. age_group ('youth', 'adult',
    'senior') is there if you want to show "Senior host" etc.
  - stores/skillSwap.js is the closest example to copy: sessions with a
    host, a date and time, attendees and capacity, all in Supabase.
  - lib/points.js already has pointsForHangout(durationMinutes).
  - The backend is Supabase, NOT Express + MongoDB as in the proposal.

  STEP BY STEP (build in this order, each step works on its own)

  1. Hotspots (src/lib/hotspots.js, new file)
     A plain array: { id, name, latitude, longitude, outdoor, weatherArea }.
     Real example from OneMap: Eunos Community Club is at 1.332644, 103.915255.
     weatherArea is the forecast area to use, see step 6 (Geylang, Bedok or
     Paya Lebar are the closest to Eunos). Hotspots rarely change, so a file
     is enough; no table needed.

  2. Database (add a new numbered section to supabase/schema.sql)
     hangouts: id, host_id (default auth.uid(), references profiles), title,
       description, hotspot_id, hangout_date, hangout_time, duration,
       status ('open' | 'completed' | 'cancelled'), created_at.
     hangout_attendees: hangout_id, user_id, primary key (hangout_id, user_id).
     Then, like help_requests:
       - enable RLS and add policies (logged-in users can read; you can only
         insert a hangout as yourself)
       - grant select/insert on the columns the browser may write (section 6:
         without grants the app gets "permission denied for table ...")
       - functions for the rules, called with supabase.rpc():
         join_hangout(id), leave_hangout(id), cancel_hangout(id) (host only),
         complete_hangout(id) (host only, inserts the points into points_ledger)
     Rules: you cannot join the same hangout twice, and the host is always
     counted as attending. Run the new SQL in the Supabase SQL editor AND
     commit it, so teammates' projects match.
     Add a few sample hangouts with SQL inserts so the page is not empty.

  3. Store (src/stores/hangout.js, new file)
     Copy stores/skillSwap.js: COLUMNS with the host's name and the attendee
     ids, fromRow() to turn rows into the shape the page uses, load(), and a
     run() helper. Actions return { ok, error }:
       createHangout(data)   joinHangout(id)   leaveHangout(id)

  4. Pages and components
     - List: filter by hotspot with a <select>, like the category filter in
       views/youth/YouthHelpBoardView.vue. Show host, date, time and who is
       going. Use <EmptyState> when nothing matches.
     - Card: copy components/SkillSwapCard.vue or components/RequestCard.vue
       (title always visible, details on hover or tap). Make HangoutCard.vue.
     - Propose a hangout: HangoutForm.vue modelled on components/RequestForm.vue
       (errors ref, validate on submit, emit('save')). Put it on its own page,
       e.g. views/hangouts/HangoutCreateView.vue, and add ONE line to
       sharedChildren in router/index.js (e.g. path: 'hangouts/new').
     - Date and time helpers can be reused from lib/skillSwapFormat.js.

  5. Map with OneMap (pnpm add leaflet)
     Turn an address into coordinates:
       GET https://www.onemap.gov.sg/api/common/elastic/search
           ?searchVal=eunos community club&returnGeom=Y&getAddrDetails=Y&pageNum=1
       -> results[0].LATITUDE and results[0].LONGITUDE (strings, use Number()).
     Show the map with Leaflet and OneMap's map tiles, one marker per hotspot.
     Docs (tile URL, attribution, tokens): https://www.onemap.gov.sg/apidocs
     fetch() is enough; axios is optional. If OneMap asks for a token, keep it
     in .env as VITE_ONEMAP_TOKEN (and add an empty line for it to
     .env.example), never in the code.

  6. Weather warning (data.gov.sg)
       GET https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
       -> data.items[0].forecasts = [{ area: 'Bedok', forecast: 'Partly Cloudy (Day)' }, ...]
     Find the entry whose area equals the hotspot's weatherArea. Warn when the
     forecast text contains "Rain", "Showers" or "Thunder". Only do this for
     hotspots with outdoor: true. Put the fetch in src/lib/weather.js so tests
     can replace it. If the request fails, show the hangout WITHOUT a warning
     and never block the page.

  7. Points
     Points can only be added by database functions (the browser is not
     allowed to write to points_ledger). Award them in complete_hangout(),
     using the same rule as pointsForHangout() in lib/points.js. Do not call
     pointsStore.awardPoints(): it only saves in the browser. After completing,
     call usePointsStore().load() so the navbar shows the new total.

  8. Tests (e2e/hangouts.spec.js, copy the style of e2e/helpboard.spec.js)
     Propose a hangout, join it, and the rain warning (use page.route() to
     return a fake forecast so the test never depends on the real API).
     Tests sign up real accounts (see e2e/helpers.js), so point .env at a
     test Supabase project.

  SENIOR-FRIENDLY RULES (also in README.md and CONTRIBUTING.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state, keep the page calm (details on hover or tap).
  Text is 22px (theme.css), so check your layout at that size and on a phone.
*/
import { ref, computed, onMounted } from 'vue'
import { useHangoutStore } from '../../stores/hangout.js'
import { hotspots, findHotspot } from '../../lib/hotspots.js'
import { loadForecasts, weatherWarning } from '../../lib/weather.js'
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
    weatherWarning: weatherWarning(findHotspot(h.hotspotId), forecasts.value),
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
