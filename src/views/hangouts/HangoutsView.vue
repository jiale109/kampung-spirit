<script setup>
/*
  ============================================================================
  GUIDE: Hotspot Hangouts                                Owner: Lee Jia Le
  ============================================================================
  This page is a PLACEHOLDER. Replace the template with the real feature.

  Route:  /app/hangouts and /app/hangouts (same page for both roles, see
          sharedChildren in router/index.js). To show something different per
          role, read useAuthStore().user.role.

  WHAT THE PROPOSAL SAYS
  Residents propose casual, low-pressure hangouts (morning walks, kopi and
  newspaper chats, herb-garden sessions) at familiar estate hotspots (the CC,
  the market, the garden). Others browse hangouts by hotspot and join.
  Hotspots appear on a map using the OneMap API. Outdoor hangouts show the
  data.gov.sg 2-hour weather forecast, so residents are warned if rain is
  expected.

  STEP BY STEP (build in this order, each step works on its own)

  1. Hotspots (src/lib/hotspots.js, new file)
     A plain array: { id, name, latitude, longitude, outdoor, weatherArea }.
     Real example from OneMap: Eunos Community Club is at 1.332644, 103.915255.
     weatherArea is the forecast area to use, see step 6 (Geylang, Bedok or
     Paya Lebar are the closest to Eunos).

  2. Sample data (src/lib/seed.js)
     Add seedHangouts() next to seedRequests(). A hangout could look like:
       { id, title, hotspotId, hostId, hostName, date: '2026-10-17',
         time: '08:00', attendeeIds: [], createdAt: Date.now() }
     Seniors and youths can both host, so hostId can be any user id in `users`.

  3. Store (src/stores/hangout.js, new file)
     Copy the pattern of stores/helpRequest.js: a setup store, a ref loaded
     from localStorage (use a NEW storage key) and a watch() that saves it.
     Actions to write (return { ok, error } for anything that can fail, like
     acceptRequest does):
       createHangout(data)   joinHangout(id)   leaveHangout(id)
     Rules: you cannot join the same hangout twice, and the host is always
     counted as attending.

  4. Pages and components
     - List: filter by hotspot with a <select>, like the category filter in
       views/app/YouthHelpBoardView.vue. Show host, date, time and who is
       going. Use <EmptyState> when nothing matches.
     - Card: reuse the idea in components/RequestCard.vue (title always
       visible, details on hover or tap). Make HangoutCard.vue.
     - Propose a hangout: HangoutForm.vue modelled on components/RequestForm.vue
       (errors ref, validate on submit, emit('save')). Put it on its own page,
       e.g. views/hangouts/HangoutCreateView.vue, and add the route to
       sharedChildren in router/index.js.

  5. Map with OneMap (pnpm add axios leaflet)
     Turn an address into coordinates:
       GET https://www.onemap.gov.sg/api/common/elastic/search
           ?searchVal=eunos community club&returnGeom=Y&getAddrDetails=Y&pageNum=1
       -> results[0].LATITUDE and results[0].LONGITUDE (strings, use Number()).
     Show the map with Leaflet and OneMap's map tiles, one marker per hotspot.
     Docs (tile URL, attribution, tokens): https://www.onemap.gov.sg/apidocs
     Checked while writing this guide: search worked without a token. If it
     starts asking for one, keep it in a .env file, never in the code.

  6. Weather warning (data.gov.sg)
       GET https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
       -> data.items[0].forecasts = [{ area: 'Bedok', forecast: 'Partly Cloudy (Day)' }, ...]
     Find the entry whose area equals the hotspot's weatherArea. Warn when the
     forecast text contains "Rain", "Showers" or "Thunder". Only do this for
     hotspots with outdoor: true. Put the fetch in src/lib/weather.js so tests
     can replace it. If the request fails, show the hangout WITHOUT a warning
     and never block the page.

  7. Points
     Attending or hosting earns points. Do not write points yourself: agree
     with the Rewards owner on one function, e.g. awardPoints(userId, amount, reason).

  8. Tests (e2e/hangouts.spec.js, copy the style of e2e/helpboard.spec.js)
     Propose a hangout, join it, and the rain warning (use page.route() to
     return a fake forecast so the test never depends on the real API).

  SENIOR-FRIENDLY RULES (also in README.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state, keep the page calm (details on hover or tap).
  Senior pages are already 22px text, so check your layout at that size.
*/
import EmptyState from '../../components/EmptyState.vue'
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Hangouts</h1>
        <p class="page-subtitle">Casual meet-ups at your estate's favourite spots.</p>
      </div>
    </div>

    <EmptyState message="Hangouts are coming soon." />
  </div>
</template>
