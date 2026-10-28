<script setup>
import { ref, computed, nextTick} from 'vue'
import {
  dateOptions,
  todayISO,
  sessionStart,
  TIME_OPTIONS,
  DURATION_OPTIONS,
  CAPACITY_OPTIONS,
  CATEGORIES,
  tidyCategory,
  MAX_CATEGORY_LENGTH,
  MIN_CAPACITY,
  MAX_CAPACITY,
} from '../lib/skillSwapFormat.js'
import DayPicker from '../components/DayPicker.vue'   // adjust path to wherever it lives
import HotspotMap from '../components/HotspotMap.vue'

defineProps({
  //cancel --> session list 
  cancelTo: { type: String, required: true },
  serverError: { type: String, default: '' },
})
const emit = defineEmits(['submit'])

const dates = dateOptions()

const form = ref({
  title: '',
  description: '',
  category: '',
  // venue is the name people read; the two numbers are the pin on the map
  venue: '',
  latitude: null,
  longitude: null,
  date: dates[0].value,
  time: '15:00',
  duration: 60,
  capacity: 6,
})
const errors = ref({})

/*
  THE KIND OF SESSION
  Laid out like Interests on the profile page: tiles, a cross to take one off
  the list, and a box to add your own. Two differences, both forced by what
  the thing is rather than by taste:

  - Only ONE can be chosen. A session is one kind, and the card and the
    filters show one word.
  - Taking a suggestion off lasts only while this form is open. Interests are
    a lasting part of a profile, so hiding one is saved; this form is filled
    in once per session, so saving the choice would mean asking the database
    to remember something nobody would ever look at again.

  Anything typed goes through tidyCategory(), which folds 'cooking' into the
  'Cooking' tile. That is what keeps two people teaching the same thing from
  filing it under two different words now the fixed list is gone.
*/
const extraCategories = ref([])
const hiddenCategories = ref([])
const newCategory = ref('')
const categoryError = ref('')

const allCategoryOptions = computed(() => [
  ...CATEGORIES.filter((c) => !hiddenCategories.value.includes(c)),
  ...extraCategories.value,
])

function addCategory() {
  categoryError.value = ''
  const name = tidyCategory(newCategory.value)

  if (name === '') {
    categoryError.value = 'Please write a kind of session first.'
    return
  }
  if (name.length > MAX_CATEGORY_LENGTH) {
    categoryError.value = `Please keep it to ${MAX_CATEGORY_LENGTH} letters or fewer.`
    return
  }

  // One that was taken off comes back to its place, rather than joining the
  // end as a second copy of itself
  if (hiddenCategories.value.includes(name)) {
    hiddenCategories.value = hiddenCategories.value.filter((item) => item !== name)
  } else if (!allCategoryOptions.value.includes(name)) {
    extraCategories.value = [...extraCategories.value, name]
  }

  // Whichever way it got there, it arrives chosen
  form.value.category = name
  errors.value.category = ''
  newCategory.value = ''
}

/*
  Take a tile off the list. Offered only when that tile is NOT the chosen one,
  so the cross can never be mistaken for "unchoose this" - pressing the tile
  itself is what does that.
*/
function removeCategory(name) {
  if (extraCategories.value.includes(name)) {
    extraCategories.value = extraCategories.value.filter((item) => item !== name)
  } else {
    hiddenCategories.value = [...hiddenCategories.value, name]
  }
  if (form.value.category === name) form.value.category = ''
  categoryError.value = ''
}
const errorCount = computed(() => Object.keys(errors.value).length)

/*
  A place chosen from the OneMap search: it comes with a name.
  A spot tapped on the map gives coordinates only, so the host names it -
  an earlier search's name is cleared, or it would label the wrong place.
*/
function onPlaceFound(place) {
  form.value.venue = place.name
  form.value.latitude = place.lat
  form.value.longitude = place.lng
  errors.value.venue = ''
}

function onPlacePicked(point) {
  form.value.venue = ''
  form.value.latitude = point.lat
  form.value.longitude = point.lng
  errors.value.venue = ''
}

// True once somewhere has been chosen, either way
const hasPin = computed(
  () => Number.isFinite(form.value.latitude) && Number.isFinite(form.value.longitude),
)

function validate() {
  const f = form.value
  const e = {}

  if (f.title.trim().length < 5) e.title = 'Please write at least 5 letters.'
  if (!f.description.trim()) e.description = 'Tell people what they will learn.'
  if (!f.category) e.category = 'Please choose a type of session.'
  // Same two-step check as the hangout form: somewhere on the map first,
  // then a name for it that neighbours can actually find
  if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) {
    e.venue = 'Please choose where it will be: search for a place, or tap the map.'
  } else if (f.venue.trim().length < 3) {
    e.venue = 'Please give this place a name, so people know where to go.'
  }

  if (!f.date || f.date < todayISO()) {
    e.date = 'Pick a day that has not passed.'
  } else if (f.time && sessionStart(f.date, f.time) < new Date()) {
    e.time = 'Pick a time that has not passed yet.'
  }

  const cap = Number(f.capacity)
  if (!Number.isInteger(cap) || cap < MIN_CAPACITY || cap > MAX_CAPACITY) {
    e.capacity = `Choose between ${MIN_CAPACITY} and ${MAX_CAPACITY} people.`
  }

  errors.value = e
  return Object.keys(e).length === 0
}

async function onSubmit() {
  if (!validate()) {
    await nextTick()
    // Put the cursor on the first field with a problem
    const first = Object.keys(errors.value)[0]
    document.getElementById(`swap-${first}`)?.focus()
    return
  }
  const f = form.value
  emit('submit', {
    title: f.title.trim(),
    description: f.description.trim(),
    category: f.category,
    venue: f.venue.trim(),
    latitude: f.latitude,
    longitude: f.longitude,
    date: f.date,
    time: f.time,
    duration: Number(f.duration),
    capacity: Number(f.capacity),
  })
}
</script>

<template>
  <form novalidate @submit.prevent="onSubmit">
    <div v-if="errorCount" class="alert alert-danger" role="alert">
      Please fix {{ errorCount === 1 ? '1 thing' : `${errorCount} things` }} below, then try again.
    </div>
    <div v-else-if="serverError" class="alert alert-danger" role="alert">{{ serverError }}</div>

    <!-- name -->
    <div class="mb-4">
      <label for="swap-title" class="form-label">Name of your session</label>
      <div id="swap-title-help" class="form-text mt-0 mb-2">Keep it short, for example: Crochet for beginners.</div>
      <input
        id="swap-title"
        v-model="form.title"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.title }"
        autocomplete="off"
        :aria-invalid="!!errors.title"
        aria-describedby="swap-title-help swap-title-error"
      />
      <div v-if="errors.title" id="swap-title-error" class="invalid-feedback">{{ errors.title }}</div>
    </div>

    <!-- desc -->
    <div class="mb-4">
      <label for="swap-description" class="form-label">What will people learn?</label>
      <textarea
        id="swap-description"
        v-model="form.description"
        rows="4"
        class="form-control"
        :class="{ 'is-invalid': errors.description }"
        placeholder="For example: the basic stitches, and how to make a coaster."
        :aria-invalid="!!errors.description"
        aria-describedby="swap-description-error"
      ></textarea>
      <div v-if="errors.description" id="swap-description-error" class="invalid-feedback">
        {{ errors.description }}
      </div>
    </div>

<!--
      The same tiles as Interests on the profile page. categoryClass() used to
      be on these: it paints one colour per HELP BOARD category, and only
      'Tech' overlaps with the session types, so Tech came out blue and the
      other six teal. Dropping it makes all seven match each other and match
      the profile page.

      One choice, not many, because the database only accepts one category
      (schema.sql section 8). Pressing the chosen one again clears it, the way
      an interest does.
    -->
    <fieldset class="mb-4">
      <legend class="form-label fs-6">What kind of session is it?</legend>
      <p class="page-subtitle mb-2">Choose one. Press it again to remove it.</p>
      <div class="row row-cols-1 row-cols-sm-2 g-2">
        <div v-for="(c, i) in allCategoryOptions" :key="c" class="col">
          <!-- The cross sits BESIDE the tile, not inside it: a button within
               a button is not allowed and a screen reader cannot reach it. -->
          <div class="interest-tile-wrap">
            <button
              :id="i === 0 ? 'swap-category' : null"
              type="button"
              class="btn choice-tile w-100"
              :class="{ active: form.category === c }"
              :aria-pressed="form.category === c"
              :data-testid="`category-${c}`"
              @click="form.category = form.category === c ? '' : c"
            >
              {{ c }}
            </button>
            <button v-if="form.category !== c" type="button" class="interest-remove"
              :aria-label="`Remove ${c} from the list`" :data-testid="`remove-category-${c}`"
              @click="removeCategory(c)">&times;</button>
          </div>
        </div>
      </div>

      <!-- Anything the suggestions have missed. Enter adds it; without
           .prevent Enter would send the whole form instead. -->
      <div class="mt-3">
        <label for="swap-new-category" class="form-label">Something else</label>
        <div class="row g-2">
          <div class="col">
            <input id="swap-new-category" v-model="newCategory" type="text" class="form-control"
              :class="{ 'is-invalid': categoryError }" :maxlength="MAX_CATEGORY_LENGTH"
              placeholder="e.g. Mahjong" data-testid="new-category"
              @keydown.enter.prevent="addCategory" @input="categoryError = ''" />
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-outline-primary h-100" data-testid="add-category"
              @click="addCategory">Add</button>
          </div>
        </div>
        <div v-if="categoryError" class="invalid-feedback d-block" role="alert"
          data-testid="category-error">{{ categoryError }}</div>
        <div class="form-text">It joins the list above, already chosen.</div>
      </div>
      <div v-if="errors.category" id="swap-category-error" class="invalid-feedback d-block">
        {{ errors.category }}
      </div>
      <button v-if="form.category" type="button" class="btn btn-outline-secondary mt-2" @click="form.category = ''">Clear choice</button>
    </fieldset>

<!--
      Venue: the same picker the hangout and help request forms use. Searching
      or tapping the map sets the pin, and the name stays editable because
      reading a name back from coordinates needs a OneMap token that expires
      every few days, and OneMap's own names are sometimes unreadable.
    -->
    <div class="mb-4">
      <div id="swap-venue-help" class="form-text mt-0 mb-2">
        Use a public place, such as a community club or void deck.
      </div>

      <HotspotMap label="Where will it be?" pickable
        hint="Search for a place, or tap the map to put the pin exactly where you mean."
        @select="onPlaceFound" @pick="onPlacePicked" />

      <div v-if="hasPin" class="mt-3">
        <label for="swap-venue" class="form-label">What is this place called?</label>
        <input
          id="swap-venue"
          v-model="form.venue"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': errors.venue }"
          maxlength="80"
          autocomplete="off"
          placeholder="e.g. the void deck of Blk 412"
          data-testid="swap-venue"
          :aria-invalid="!!errors.venue"
          aria-describedby="swap-venue-help swap-venue-error"
          @input="errors.venue = ''"
        />
        <div v-if="errors.venue" id="swap-venue-error" class="invalid-feedback">{{ errors.venue }}</div>
        <div class="form-text">People will see this name, so make it easy to find.</div>
      </div>
      <div v-else-if="errors.venue" id="swap-venue-error" class="invalid-feedback d-block" role="alert">
        {{ errors.venue }}
      </div>
    </div>

    <!-- day -->
<div class="mb-4">
  <label id="swap-date-label" class="form-label">Which day?</label>
  <DayPicker
    id="swap-date"
    v-model="form.date"
    :min="dates[0].value"
    :max="dates[dates.length - 1].value"
    :invalid="!!errors.date"
  />
  <div v-if="errors.date" id="swap-date-error" class="invalid-feedback d-block">{{ errors.date }}</div>
</div>

    <!-- time & duration -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6">
        <label for="swap-time" class="form-label">What time?</label>
        <select
          id="swap-time"
          v-model="form.time"
          class="form-select"
          :class="{ 'is-invalid': errors.time }"
          :aria-invalid="!!errors.time"
          aria-describedby="swap-time-error"
        >
          <option v-for="t in TIME_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <div v-if="errors.time" id="swap-time-error" class="invalid-feedback">{{ errors.time }}</div>
      </div>
      <div class="col-sm-6">
        <label for="swap-duration" class="form-label">How long?</label>
        <select id="swap-duration" v-model="form.duration" class="form-select">
          <option v-for="d in DURATION_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>
    </div>

    <!-- capacity -->
    <div class="mb-4">
      <label for="swap-capacity" class="form-label">How many people can join?</label>
      <div id="swap-capacity-help" class="form-text mt-0 mb-2">
        Choose from {{ MIN_CAPACITY }} to {{ MAX_CAPACITY }} people.
      </div>
      <select
        id="swap-capacity"
        v-model="form.capacity"
        class="form-select w-auto"
        :class="{ 'is-invalid': errors.capacity }"
        :aria-invalid="!!errors.capacity"
        aria-describedby="swap-capacity-help swap-capacity-error"
      >
        <option v-for="c in CAPACITY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <div v-if="errors.capacity" id="swap-capacity-error" class="invalid-feedback">{{ errors.capacity }}</div>
    </div>

    <div class="form-actions">
      <RouterLink :to="cancelTo" class="btn btn-outline-secondary btn-lg">Cancel</RouterLink>
      <button type="submit" class="btn btn-primary btn-lg">Share my session</button>
    </div>
  </form>
</template>
