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
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { usePointsStore } from '../../stores/points.js'
import { interests as interestOptions, applyLargeText } from '../../lib/profile.js'

const auth = useAuthStore()
const points = usePointsStore()

// The database works the age group out from the birth date, so it is read
// only here. Plain words, because "youth" on its own means little.
const ageGroupLabels = {
  youth: 'Youth (12 to 21)',
  adult: 'Adult (22 to 64)',
  senior: 'Senior (65 and over)',
}
const ageGroupLabel = computed(() => ageGroupLabels[auth.user.age_group] ?? 'Not known')

// Under 18s need a parent or guardian to confirm before they can accept tasks.
// 'not_needed' (18 and over) shows nothing at all.
const guardianNote = computed(() => {
  if (auth.user.guardian_status === 'pending') {
    return 'Waiting for your parent or guardian to confirm. You can look around, but you cannot accept tasks yet.'
  }
  if (auth.user.guardian_status === 'verified') {
    return 'Your parent or guardian has confirmed. You can accept tasks.'
  }
  return ''
})

// A pixel sprite for the age group, shown beside the details. The files live
// in public/images, so the path starts from the site root. age_group comes
// from the database, so an unknown value just shows no picture.
const ageIcons = {
  youth: '/images/youth-icon.svg',
  adult: '/images/adult-icon.svg',
  senior: '/images/senior-icon.svg',
}
const ageIcon = computed(() => ageIcons[auth.user.age_group] ?? '')

// interests can be null on an older row, so fall back to an empty list
const myInterests = computed(() => auth.user.interests ?? [])

// The page is either reading or editing, never both: one main action per screen
const editing = ref(false)
const form = ref({ name: '', block: '', interests: [], largeText: false })
const errors = ref({})
const saving = ref(false)
const message = ref('')
const saveError = ref('')

function startEditing() {
  // Copy the saved values in, so Cancel can simply throw the copy away.
  // interests is copied with [...] so toggling does not touch the store.
  form.value = {
    name: auth.user.name,
    block: auth.user.block,
    interests: [...myInterests.value],
    largeText: auth.user.large_text === true,
  }
  errors.value = {}
  message.value = ''
  saveError.value = ''
  editing.value = true
}

function stopEditing() {
  editing.value = false
  errors.value = {}
  saveError.value = ''
}

function isChosen(name) {
  return form.value.interests.includes(name)
}

function toggleInterest(name) {
  if (isChosen(name)) {
    form.value.interests = form.value.interests.filter((chosen) => chosen !== name)
  } else {
    form.value.interests = [...form.value.interests, name]
  }
}

async function save() {
  errors.value = {}
  saveError.value = ''

  if (form.value.name.trim().length < 2) {
    errors.value.name = 'Please write your name.'
  }
  if (form.value.block.trim().length < 3) {
    errors.value.block = 'Please write your block and street, like Blk 412 Eunos Cres.'
  }

  // Stop here if anything is wrong
  if (Object.keys(errors.value).length > 0) return

  saving.value = true
  const result = await auth.updateProfile({
    name: form.value.name.trim(),
    block: form.value.block.trim(),
    interests: form.value.interests,
    largeText: form.value.largeText,
  })
  saving.value = false

  if (result.ok) {
    editing.value = false
    message.value = 'Your profile is saved.'
    // Show the new text size at once. MainLayout only applies it when it
    // mounts, and it stays mounted while you move around /app, so without
    // this the change would not appear until a full page reload.
    applyLargeText(form.value.largeText)
  } else {
    saveError.value = result.error
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Profile</h1>
        <p class="page-subtitle">Your details, interests and points.</p>
      </div>
      <button v-if="!editing" type="button" class="btn btn-primary btn-lg" data-testid="edit-profile"
        @click="startEditing">Edit profile</button>
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <div v-if="saveError" class="alert alert-danger" role="alert">{{ saveError }}</div>

    <!-- 1. Reading: name, block, age group, points and interests -->
    <div v-if="!editing" class="d-grid gap-4">

      <div class="card">
        <!-- Details on the left, the age-group sprite in the space on the right -->
        <div class="card-body p-4 d-flex align-items-center">
          <div>
          <h2 class="page-title fs-4">Your details</h2>
          <dl class="row mb-0 mt-3">
            <dt class="col-sm-5">Name</dt>
            <dd class="col-sm-7" data-testid="profile-name">{{ auth.user.name }}</dd>

            <dt class="col-sm-5">Block and street</dt>
            <dd class="col-sm-7" data-testid="profile-block">{{ auth.user.block }}</dd>

            <dt class="col-sm-5">Age group</dt>
            <dd class="col-sm-7" data-testid="profile-age-group">{{ ageGroupLabel }}</dd>

            <dt class="col-sm-5">Large text</dt>
            <dd class="col-sm-7 mb-0" data-testid="profile-large-text">{{ auth.user.large_text ? 'On' : 'Off' }}</dd>
          </dl>

          <!-- Guardian status in words, not a colour or a tick -->
          <p v-if="guardianNote" class="points-note mt-4" data-testid="guardian-note">{{ guardianNote }}</p>
          </div>

          <!--
            The sprite sits in its own quarter-width column and is centred in it,
            so it sits in the middle of the empty space rather than against the
            card edge. Shown from the md breakpoint up: below that the column is
            too narrow for the artwork, so it is hidden and the details take the
            full width. 144x240 is exactly 6x the 24x40 artwork, which keeps the
            pixel art sharp - stick to multiples of 24x40 if you resize it.
            Decorative: the age group is written out in the list above, so alt
            is empty and a screen reader does not say it twice.
          -->
          <div class="w-25 d-none d-md-flex justify-content-center flex-shrink-0">
            <img v-if="ageIcon" :src="ageIcon" alt="" width="144" height="240" data-testid="age-icon" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body p-4">
          <h2 class="page-title fs-4">Points</h2>
          <p class="points-note mt-3 mb-0" data-testid="profile-points">
            You have <strong>{{ points.myPoints }} points</strong> to spend on vouchers.
          </p>
        </div>
      </div>

      <div class="card">
        <div class="card-body p-4">
          <h2 class="page-title fs-4">Interests</h2>
          <p class="page-subtitle mb-3">Neighbours can see these, so they know what you enjoy.</p>

          <ul v-if="myInterests.length > 0" class="list-unstyled d-flex flex-wrap gap-3 mb-0"
            data-testid="profile-interests">
            <li v-for="name in myInterests" :key="name" class="category-label">{{ name }}</li>
          </ul>
          <p v-else class="mb-0">
            You have not chosen any interests yet. Press &ldquo;Edit profile&rdquo; to add some.
          </p>
        </div>
      </div>

    </div>

    <!-- 2. Editing: only the four things the database lets a user change -->
    <form v-else class="card form-page" novalidate @submit.prevent="save">
      <div class="card-body p-4 d-grid gap-4">

        <div>
          <label for="name" class="form-label">Your name</label>
          <input id="name" v-model="form.name" type="text" class="form-control"
            :class="{ 'is-invalid': errors.name }" maxlength="60" />
          <div class="invalid-feedback">{{ errors.name }}</div>
        </div>

        <div>
          <label for="block" class="form-label">Block and street</label>
          <input id="block" v-model="form.block" type="text" class="form-control"
            :class="{ 'is-invalid': errors.block }" maxlength="80" placeholder="e.g. Blk 412 Eunos Cres" />
          <div class="invalid-feedback">{{ errors.block }}</div>
        </div>

        <!-- Big toggle buttons, like the category tiles in RequestForm.vue -->
        <div role="group" aria-labelledby="interests-label">
          <div id="interests-label" class="form-label">Interests</div>
          <p class="page-subtitle mb-3">Choose as many as you like. Press one again to remove it.</p>
          <div class="row row-cols-1 row-cols-sm-2 g-2">
            <div v-for="option in interestOptions" :key="option" class="col">
              <button type="button" class="btn choice-tile w-100" :class="{ active: isChosen(option) }"
                :aria-pressed="isChosen(option)" @click="toggleInterest(option)">{{ option }}</button>
            </div>
          </div>
        </div>

        <!-- Same switch as the sign-up page, which promises you can change it here -->
        <div class="form-check form-switch">
          <input id="large-text" v-model="form.largeText" type="checkbox" role="switch" class="form-check-input" />
          <label for="large-text" class="form-check-label">Use large text</label>
          <div class="form-text">Makes the words bigger on every page.</div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-lg btn-outline-secondary" @click="stopEditing">Cancel</button>
          <button type="submit" class="btn btn-lg btn-primary" data-testid="save-profile" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
        </div>

      </div>
    </form>
  </div>
</template>
