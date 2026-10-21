<script setup>
/*
  ============================================================================
  GUIDE: Profile                           Owners: Clarence Tay (page), Reuben Tham (data)
  ============================================================================
  STATUS: PLACEHOLDER. Replace the template with the real feature.

  Route: /app/profile (in sharedChildren in router/index.js). It is opened
  from the "Profile" item in the name dropdown in layouts/MainLayout.vue.

  WHAT THE PROPOSAL SAYS
  Profiles show the user's block, interests and points. The whole app uses
  large text and buttons, high contrast and a fully responsive layout, so it
  works as well on a senior's phone as on a desktop.

  WHAT EXISTS ALREADY
  - Real sign up and login with Supabase Auth (stores/auth.js,
    views/LandingView.vue, views/RegisterView.vue).
  - useAuthStore().user is the row from the profiles table:
      { id, name, block, interests, large_text, age_group, guardian_status }
    age_group is 'youth' (12-21), 'adult' (22-64) or 'senior' (65+), worked
    out from the birth date. There is no "role" any more: everyone can ask
    for help and everyone can help, on the same set of pages.
    guardian_status is 'not_needed', 'pending' or 'verified' (under 18s).
  - The database lets a user change ONLY name, block, interests and
    large_text on their own row (supabase/schema.sql, section 2). The birth
    date and guardian details are in profile_private and cannot be edited
    from the app.
  - Points: usePointsStore().myPoints.

  STEP BY STEP (build in this order, each step works on its own)

  1. Read (this page)
     Show name, block, age group and points. Use a Bootstrap card and the
     .page-header / .page-title classes, like the other pages. For under 18s,
     explain the guardian status in words ("Waiting for your parent or
     guardian to confirm" when it is 'pending').

  2. Interests
     Offer a fixed list to choose from (a constant in lib/profile.js, new
     file) shown as big toggle buttons, like the category tiles in
     components/RequestForm.vue (.choice-tile). A fixed list avoids typos.
     interests is a text[] column, so save an array of strings.

  3. Update (auth store, Reuben)
     In stores/auth.js add updateProfile({ name, block, interests, largeText })
     that runs supabase.from('profiles').update({...}).eq('id', user.id),
     then reloads the profile. Return { ok, error }. Validate on submit like
     RequestForm.vue (errors ref).

  4. Large text setting
     large_text is chosen at sign up and saved, but nothing uses it yet.
     Today theme.css makes the text 22px for everyone (html font-size 137.5%).
     Agree with the team: either keep 22px for all, or use 18px by default and
     add a class (e.g. .large-text) on MainLayout when auth.user.large_text
     is true. Then add the switch here.

  5. Delete account
     A "Delete my account" button that opens a confirmation modal (copy the
     modal in views/senior/SeniorHelpBoardView.vue). The browser cannot delete
     a Supabase Auth user by itself, so this needs a database function
     (security definer) or an Edge Function. Talk to Reuben first. After it
     succeeds, call auth.logout() and go to /landing.

  6. Tests (e2e/profile.spec.js, copy the style of e2e/landing.spec.js)
     The profile shows the right name and block, editing interests persists
     after a reload, and a senior and a youth both reach /app/profile.

  SENIOR-FRIENDLY RULES (also in README.md and CONTRIBUTING.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Check your layout at 22px text and on a phone.
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
