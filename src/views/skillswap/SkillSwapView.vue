<script setup>
/*
  ============================================================================
  GUIDE: Skill-Swap Circles                                Owner: Kelsey Wong
  ============================================================================
  This page is a PLACEHOLDER. Replace the template with the real feature.

  Route:  /senior/skill-swaps and /youth/skill-swaps (same page for both
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
import EmptyState from '../../components/EmptyState.vue'
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Skill Swaps</h1>
        <p class="page-subtitle">Small sessions where neighbours teach each other.</p>
      </div>
    </div>

    <EmptyState message="Skill Swaps are coming soon." />
  </div>
</template>
