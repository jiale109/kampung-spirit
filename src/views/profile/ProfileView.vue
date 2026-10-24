<script setup>
/*
  ============================================================================
  GUIDE: Profile                           Owners: Clarence Tay (page), Reuben Tham (data)
  ============================================================================
  Route: /app/profile (the "Profile" item in the name menu in MainLayout.vue).
  Shows name, block, age group, guardian status (under 18s) and points, and
  lets the person edit name, block, interests and "Use large text".

  Uses: stores/auth.js (user, updateProfile()), stores/points.js (myPoints),
  lib/profile.js (the fixed interests list and applyLargeText()). The
  database only lets a user change name, block, interests and large_text on
  their own row (supabase/schema.sql section 2).

  STILL LEFT: "Delete my account" (the browser cannot delete a Supabase Auth
  user, so it needs a security definer function or an Edge Function; talk to
  Reuben first), and an e2e test for editing the profile.
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
