<script setup>
import { ref, computed, nextTick} from 'vue'
import {
  dateOptions,
  todayISO,
  sessionStart,
  categoryClass,
  TIME_OPTIONS,
  DURATION_OPTIONS,
  CAPACITY_OPTIONS,
  CATEGORIES,
  MIN_CAPACITY,
  MAX_CAPACITY,
} from '../lib/skillSwapFormat.js'

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
  venue: '',
  date: dates[0].value,
  time: '15:00',
  duration: 60,
  capacity: 6,
})
const errors = ref({})
const errorCount = computed(() => Object.keys(errors.value).length)

function validate() {
  const f = form.value
  const e = {}

  if (f.title.trim().length < 5) e.title = 'Please write at least 5 letters.'
  if (!f.description.trim()) e.description = 'Tell people what they will learn.'
  if (!f.category) e.category = 'Please choose a type of session.'
  if (f.venue.trim().length < 3) e.venue = 'Please say where it will be.'

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

    <!-- session cat -->
    <fieldset class="mb-4">
      <legend class="form-label fs-6">What kind of session is it?</legend>
      <div class="row g-2">
        <div v-for="(c, i) in CATEGORIES" :key="c" class="col-sm-6">
          <button
            :id="i === 0 ? 'swap-category' : null"
            type="button"
            class="btn choice-tile w-100"
            :class="[categoryClass(c), { active: form.category === c }]"
            :aria-pressed="form.category === c"
            @click="form.category = c"
          >
            {{ c }}
          </button>
        </div>
      </div>
      <div v-if="errors.category" id="swap-category-error" class="invalid-feedback d-block">
        {{ errors.category }}
      </div>
      <button v-if="form.category" type="button" class="btn btn-outline-secondary mt-2" @click="form.category = ''">Clear choice</button>
    </fieldset>

    <!-- Venue -->
    <div class="mb-4">
      <label for="swap-venue" class="form-label">Where will it be?</label>
      <div id="swap-venue-help" class="form-text mt-0 mb-2">
        Use a public place, such as a community club or void deck.
      </div>
      <input
        id="swap-venue"
        v-model="form.venue"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.venue }"
        autocomplete="off"
        :aria-invalid="!!errors.venue"
        aria-describedby="swap-venue-help swap-venue-error"
      />
      <div v-if="errors.venue" id="swap-venue-error" class="invalid-feedback">{{ errors.venue }}</div>
    </div>

    <!-- day -->
    <div class="mb-4">
      <label for="swap-date" class="form-label">Which day?</label>
      <select
        id="swap-date"
        v-model="form.date"
        class="form-select"
        :class="{ 'is-invalid': errors.date }"
        :aria-invalid="!!errors.date"
        aria-describedby="swap-date-error"
      >
        <option v-for="d in dates" :key="d.value" :value="d.value">{{ d.label }}</option>
      </select>
      <div v-if="errors.date" id="swap-date-error" class="invalid-feedback">{{ errors.date }}</div>
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
