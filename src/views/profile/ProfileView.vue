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
import {
  interests as interestOptions,
  applyLargeText,
  tidyInterest,
  MAX_INTEREST_LENGTH,
  GENDERS,
  SKIN_TONES,
  avatarSrc,
  toneIndex,
  toneAt,
} from '../../lib/profile.js'

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

/*
  The sprite beside the details. The age group comes from the birth date and
  cannot be changed; the gender and skin tone are the resident's own choice.
  avatarSrc() returns '' until both have been chosen, and the card then invites
  them to pick rather than showing a stranger's face.
*/
const ageIcon = computed(() =>
  avatarSrc(auth.user.age_group, auth.user.gender, auth.user.skin_tone),
)

// interests can be null on an older row, so fall back to an empty list
const myInterests = computed(() => auth.user.interests ?? [])

// The page is either reading or editing, never both: one main action per screen
const editing = ref(false)
// tone is the SLIDER POSITION (0 to 3), not the word, because
// <input type="range"> works in numbers. toneAt() turns it back into a word.
const form = ref({
  name: '', block: '', interests: [], largeText: false,
  gender: '', tone: 0, showWalker: false,
})
const errors = ref({})
const saving = ref(false)
const message = ref('')
const saveError = ref('')

/*
  Interests the person typed in themselves, kept beside the fixed list while
  the form is open. They are held separately so that switching one OFF leaves
  its tile on screen to be switched on again, instead of the tile vanishing
  the moment it is deselected.
*/
const extraOptions = ref([])

/*
  Suggestions from the fixed list that this person has taken off. They cannot
  simply be deleted, because the fixed list is shared by everybody; hiding
  them is per person, and saved in profiles.hidden_interests (schema.sql
  section 15). Typing one back into the box brings it back.
*/
const hiddenOptions = ref([])

const newInterest = ref('')
const interestError = ref('')

// The suggestions still wanted, then anything this person added
const allInterestOptions = computed(() => [
  ...interestOptions.filter((name) => !hiddenOptions.value.includes(name)),
  ...extraOptions.value,
])

/*
  Add what has been typed. tidyInterest() in lib/profile.js folds it into the
  fixed list when it is really one of those ('gardening' -> 'Gardening'), so
  typing your own does not quietly stop you matching neighbours.
*/
function addInterest() {
  interestError.value = ''
  const name = tidyInterest(newInterest.value)

  if (name === '') {
    interestError.value = 'Please write an interest first.'
    return
  }
  if (name.length > MAX_INTEREST_LENGTH) {
    interestError.value = `Please keep it to ${MAX_INTEREST_LENGTH} letters or fewer.`
    return
  }
  if (isChosen(name)) {
    interestError.value = `${name} is already one of your interests.`
    return
  }

  if (hiddenOptions.value.includes(name)) {
    // A suggestion that was taken off comes back to the fixed list, rather
    // than joining the end as one of your own
    hiddenOptions.value = hiddenOptions.value.filter((item) => item !== name)
  } else if (!allInterestOptions.value.includes(name)) {
    extraOptions.value = [...extraOptions.value, name]
  }
  // Whichever way it got there, it arrives switched on
  if (!isChosen(name)) toggleInterest(name)
  newInterest.value = ''
}

/*
  The avatar AS THE FORM CURRENTLY STANDS, so the picture changes the moment a
  gender box is pressed or the slider is moved, before anything is saved.
  Empty until a gender is chosen, because there is no neutral drawing.
*/
const previewAvatar = computed(() =>
  avatarSrc(auth.user.age_group, form.value.gender, toneAt(form.value.tone)),
)

const toneLabel = computed(() => SKIN_TONES[form.value.tone]?.label ?? '')

// Said out loud for anyone using a screen reader, since the picture itself
// carries the whole choice here (unlike the one on the card, which repeats
// the age group written beside it).
const previewAlt = computed(() => {
  if (previewAvatar.value === '') return ''
  const gender = GENDERS.find((option) => option.value === form.value.gender)
  return `${ageGroupLabel.value}, ${gender ? gender.label.toLowerCase() : ''}, ${toneLabel.value.toLowerCase()} skin tone`
})

/*
  Take a tile off the list. Offered only once that interest is switched OFF,
  so the cross cannot be mistaken for "stop liking this" - switching off is
  what pressing the tile itself does.

  One you typed in is thrown away. One of the fixed suggestions is only
  hidden, because that list belongs to everybody.
*/
function removeOption(name) {
  if (extraOptions.value.includes(name)) {
    extraOptions.value = extraOptions.value.filter((item) => item !== name)
  } else {
    hiddenOptions.value = [...hiddenOptions.value, name]
  }
  // It should already be off, but a stray copy here would be saved to the
  // database, so make sure
  form.value.interests = form.value.interests.filter((item) => item !== name)
  interestError.value = ''
}

function startEditing() {
  // Copy the saved values in, so Cancel can simply throw the copy away.
  // interests is copied with [...] so toggling does not touch the store.
  form.value = {
    name: auth.user.name,
    block: auth.user.block,
    interests: [...myInterests.value],
    largeText: auth.user.large_text === true,
    gender: auth.user.gender ?? '',
    tone: toneIndex(auth.user.skin_tone),
    showWalker: auth.user.show_walker === true,
  }
  // Anything already saved that is not on the fixed list was typed in before,
  // so it gets a tile again rather than disappearing from the form.
  extraOptions.value = myInterests.value.filter((name) => !interestOptions.includes(name))
  // Only names still on the fixed list are kept, so renaming a suggestion in
  // lib/profile.js cannot leave a dead entry hiding nothing
  hiddenOptions.value = (auth.user.hidden_interests ?? []).filter((name) =>
    interestOptions.includes(name),
  )
  newInterest.value = ''
  interestError.value = ''
  errors.value = {}
  message.value = ''
  saveError.value = ''
  editing.value = true
}

function stopEditing() {
  editing.value = false
  errors.value = {}
  saveError.value = ''
  interestError.value = ''
  newInterest.value = ''
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
    hiddenInterests: hiddenOptions.value,
    // Nothing to walk without an avatar, so the switch cannot be left on
    // pointing at a person who does not exist
    showWalker: form.value.gender === '' ? false : form.value.showWalker,
    largeText: form.value.largeText,
    // null rather than '' for a gender never chosen: the column allows null,
    // and '' would fail the check in schema.sql section 13
    gender: form.value.gender === '' ? null : form.value.gender,
    skinTone: form.value.gender === '' ? null : toneAt(form.value.tone),
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
            <!-- Nothing chosen yet. Rather than guess a gender, say so. -->
            <span v-else class="page-subtitle text-center" data-testid="no-avatar">
              Press &ldquo;Edit profile&rdquo; to choose your avatar.
            </span>
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

        <!--
          Your look. The picture on the left is the real avatar file, redrawn
          as soon as anything on the right is pressed, so there is no "save and
          hope" step. Age group is not here: it comes from the birth date.
        -->
        <div role="group" aria-labelledby="avatar-label">
          <div id="avatar-label" class="form-label">Your avatar</div>
          <p class="page-subtitle mb-3">Choose how you would like to look to your neighbours.</p>

          <div class="card avatar-picker">
            <div class="card-body p-4 d-flex flex-column flex-sm-row align-items-center gap-4">

              <div class="avatar-preview flex-shrink-0 d-flex align-items-center justify-content-center">
                <img v-if="previewAvatar" :src="previewAvatar" :alt="previewAlt"
                  width="120" height="200" data-testid="avatar-preview" />
                <span v-else class="page-subtitle text-center px-2" data-testid="avatar-preview-empty">
                  Press Male or Female to see your avatar.
                </span>
              </div>

              <div class="flex-grow-1 w-100">

                <div role="group" aria-labelledby="gender-label" class="mb-4">
                  <div id="gender-label" class="form-label">Gender</div>
                  <div class="row row-cols-2 g-2">
                    <div v-for="option in GENDERS" :key="option.value" class="col">
                      <button type="button" class="btn choice-tile w-100"
                        :class="{ active: form.gender === option.value }"
                        :aria-pressed="form.gender === option.value"
                        :data-testid="`gender-${option.value}`"
                        @click="form.gender = option.value">{{ option.label }}</button>
                    </div>
                  </div>
                </div>

                <!-- The tone is NAMED in the label as well as shown as a
                     colour, so the choice never rests on colour alone. -->
                <div>
                  <label for="skin-tone" class="form-label">
                    Skin tone: <strong data-testid="tone-label">{{ toneLabel }}</strong>
                  </label>
                  <input id="skin-tone" v-model.number="form.tone" type="range" class="form-range"
                    min="0" :max="SKIN_TONES.length - 1" step="1" data-testid="skin-tone" />
                  <div class="tone-swatches" aria-hidden="true">
                    <span v-for="(tone, index) in SKIN_TONES" :key="tone.value" class="tone-swatch"
                      :class="{ 'is-chosen': index === form.tone }"
                      :style="{ backgroundColor: tone.swatch }"></span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Big toggle buttons, like the category tiles in RequestForm.vue -->
        <div role="group" aria-labelledby="interests-label">
          <div id="interests-label" class="form-label">Interests</div>
          <p class="page-subtitle mb-3">Choose as many as you like. Press one again to remove it.</p>
          <div class="row row-cols-1 row-cols-sm-2 g-2">
            <div v-for="option in allInterestOptions" :key="option" class="col">
              <!--
                The cross sits BESIDE the tile in the markup, not inside it: a
                button within a button is not allowed, and a screen reader
                would never reach it. It is placed on the corner with CSS.
              -->
              <div class="interest-tile-wrap">
                <button type="button" class="btn choice-tile w-100" :class="{ active: isChosen(option) }"
                  :aria-pressed="isChosen(option)" @click="toggleInterest(option)">{{ option }}</button>
                <button v-if="!isChosen(option)" type="button"
                  class="interest-remove" :aria-label="`Remove ${option} from the list`"
                  :data-testid="`remove-${option}`" @click="removeOption(option)">&times;</button>
              </div>
            </div>
          </div>

          <!-- Anything the list has missed. Enter adds it; without .prevent
               Enter would send the whole form instead. -->
          <div class="mt-3">
            <label for="new-interest" class="form-label">Something else you enjoy</label>
            <div class="row g-2">
              <div class="col">
                <input id="new-interest" v-model="newInterest" type="text" class="form-control"
                  :class="{ 'is-invalid': interestError }" :maxlength="MAX_INTEREST_LENGTH"
                  placeholder="e.g. Mahjong" data-testid="new-interest"
                  @keydown.enter.prevent="addInterest" @input="interestError = ''" />
              </div>
              <div class="col-auto">
                <button type="button" class="btn btn-outline-primary" data-testid="add-interest"
                  @click="addInterest">Add</button>
              </div>
            </div>
            <div v-if="interestError" class="invalid-feedback d-block" role="alert"
              data-testid="interest-error">{{ interestError }}</div>
            <div class="form-text">It joins the list above, already switched on.</div>
          </div>
        </div>

        <!--
          Movement that starts on its own has to be something people can turn
          off (WCAG 2.2.2), so it is off until asked for. theme.css also
          honours prefers-reduced-motion, for anyone whose computer has
          already said it wants less movement.
        -->
        <div class="form-check form-switch">
          <input id="show-walker" v-model="form.showWalker" type="checkbox" role="switch"
            class="form-check-input" :disabled="form.gender === ''" data-testid="walker-switch" />
          <label for="show-walker" class="form-check-label">Show my avatar walking</label>
          <div class="form-text">
            <template v-if="form.gender === ''">Choose your avatar above first.</template>
            <template v-else>Your avatar strolls along the green bar at the top.</template>
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
