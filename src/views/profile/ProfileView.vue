<script setup>
/*
  ============================================================================
  GUIDE: Profile                           Owners: Clarence Tay (page), Reuben Tham (data)
  ============================================================================
  This page is a PLACEHOLDER. Replace the template with the real feature.

  Route:  /app/profile and /app/profile (same page for both roles, see
          sharedChildren in router/index.js). It is opened from the "Profile"
          item in the name dropdown of the navbar.

  WHAT THE PROPOSAL SAYS
  Users sign up and log in as a Senior or a Youth. Their role controls what
  they see and can do. Profiles show the user's block, interests and points.
  The whole app uses large text and buttons, high contrast and a fully
  responsive layout, so it works as well on a senior's phone as on a desktop.

  WHAT EXISTS ALREADY
  - stores/auth.js: auth.user is { id, name, role, block } (demo login, no
    password). The users list is in lib/seed.js.
  - theme.css: senior pages use 22px text and everyone else 18px.

  STEP BY STEP (build in this order, each step works on its own)

  1. Read (this page)
     Show name, role, block and points from useAuthStore().user. For points
     read the balance from the points store once Rewards has built it
     (useHelpRequestStore().myPoints works until then). Use a Bootstrap
     card and the .page-header / .page-title classes, like the other pages.

  2. Interests
     Add `interests: []` to each user in lib/seed.js (e.g. ['Cooking', 'Walking']).
     Offer a fixed list to choose from (a constant in lib/profile.js, new file)
     shown as big toggle buttons, like the category tiles in
     components/RequestForm.vue (.choice-tile). A fixed list avoids typos.

  3. Update (auth store)
     In stores/auth.js add updateProfile({ block, interests }) that changes
     auth.user and saves it the same way login() does. Return { ok, error }.
     Validate on submit like RequestForm.vue (errors ref).

  4. Delete account
     Add a "Delete my account" button that opens a confirmation modal (copy the
     modal in views/app/SeniorHelpBoardView.vue), then calls auth.logout()
     and routes to /landing. With a real backend this is DELETE /users/me.

  5. Real sign up and login (Reuben)
     The landing page (views/LandingView.vue) has a demo login with no
     password. See the GUIDE comment in that file and in stores/auth.js.

  6. Tests (e2e/profile.spec.js, copy the style of e2e/landing.spec.js)
     The profile shows the right name and block, editing interests persists
     after a reload, and a senior and a youth both reach /profile.

  SENIOR-FRIENDLY RULES (also in README.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Senior pages are already 22px text, so check
  your layout at that size.
*/
import EmptyState from '../../components/EmptyState.vue'
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Profile</h1>
        <p class="page-subtitle">Your details, interests and points.</p>
      </div>
    </div>

    <EmptyState message="Profiles are coming soon." />
  </div>
</template>
