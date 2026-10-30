<script setup>
/*
  A calendar for choosing a day                          Owner: Clarence Tay

  WHY THIS EXISTS
  <input type="date"> hands the calendar to the browser and the operating
  system, and nothing in our stylesheet can reach it. On Windows it comes out
  far smaller than the 22px text the rest of the app uses, which is exactly
  the wrong way round for the residents this app is for. So the month is drawn
  here instead, out of ordinary buttons we can size ourselves.

  It is used with v-model, like any form control:
    <DayPicker v-model="form.date" :min="FIRST_DAY" :max="LAST_DAY" />
  The value is a plain 'YYYY-MM-DD' string, the same shape <input type="date">
  gave back and the same shape the database wants, so nothing else changed.

  SENIOR-FRIENDLY RULES
  Every day is a big button, not a number to aim at. Days outside min and max
  are left out rather than shown greyed, so there is nothing to press by
  mistake. The chosen day is written out in words underneath as well as being
  filled in, because the briefing says never to use colour alone to show a
  state.
*/
import { ref, computed } from 'vue'
import { toISO, formatDate } from '../lib/skillSwapFormat.js'

const props = defineProps({
  // The chosen day, 'YYYY-MM-DD'. Empty means nothing is chosen yet.
  modelValue: { type: String, default: '' },
  // The first and last day that may be picked, also 'YYYY-MM-DD'
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  // Draws the red border, to match .is-invalid on the other boxes
  invalid: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Sunday first, the way a Singapore wall calendar is laid out
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// '2026-10-25' -> a Date at midnight LOCAL time. Built from the three numbers
// rather than new Date(string), which reads the string as UTC and can land on
// the day before in Singapore.
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Open on the month of the chosen day, or of the first day that may be picked
const opening = parseISO(props.modelValue || props.min || toISO(new Date()))
const viewYear = ref(opening.getFullYear())
const viewMonth = ref(opening.getMonth())

const monthLabel = computed(() => `${MONTHS[viewMonth.value]} ${viewYear.value}`)

/*
  Six rows of seven, always, so the card does not change height when you move
  between a short month and a long one. Each cell knows its own date; the ones
  belonging to the month either side are marked so the template can leave a
  blank there instead of a button.
*/
const weeks = computed(() => {
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  // Step back to the Sunday on or before the 1st
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - firstOfMonth.getDay())

  const rows = []
  for (let week = 0; week < 6; week++) {
    const row = []
    for (let day = 0; day < 7; day++) {
      const cell = new Date(
        gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + week * 7 + day,
      )
      const iso = toISO(cell)
      row.push({
        iso,
        number: cell.getDate(),
        inMonth: cell.getMonth() === viewMonth.value,
        // ISO dates compare correctly as plain strings, so no date maths here
        tooEarly: props.min !== '' && iso < props.min,
        tooLate: props.max !== '' && iso > props.max,
        label: formatDate(iso),
      })
    }
    rows.push(row)
  }
  return rows
})

function showMonth(step) {
  const moved = new Date(viewYear.value, viewMonth.value + step, 1)
  viewYear.value = moved.getFullYear()
  viewMonth.value = moved.getMonth()
}

// Greyed out when every day of the month next door is outside min or max,
// so the arrows never lead to an empty page
const canGoBack = computed(() => {
  if (props.min === '') return true
  const lastOfPrevious = new Date(viewYear.value, viewMonth.value, 0)
  return toISO(lastOfPrevious) >= props.min
})
const canGoForward = computed(() => {
  if (props.max === '') return true
  const firstOfNext = new Date(viewYear.value, viewMonth.value + 1, 1)
  return toISO(firstOfNext) <= props.max
})

const todayISO = toISO(new Date())
const chosenLabel = computed(() => (props.modelValue ? formatDate(props.modelValue) : ''))
</script>

<template>
  <div class="day-picker" :class="{ 'is-invalid-box': invalid }" data-testid="day-picker">

    <!--
      Which month we are looking at.

      The arrows are single characters, so they use .month-nav rather than
      btn-lg: a worded button's side padding is what pushed the month name off
      a 320px phone, especially with "Use large text" on.
    -->
    <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
      <button type="button" class="btn btn-outline-secondary month-nav" :disabled="!canGoBack"
        aria-label="Previous month" data-testid="previous-month" @click="showMonth(-1)">&lsaquo;</button>

      <strong class="month-label text-center" aria-live="polite"
        data-testid="month-label">{{ monthLabel }}</strong>

      <button type="button" class="btn btn-outline-secondary month-nav" :disabled="!canGoForward"
        aria-label="Next month" data-testid="next-month" @click="showMonth(1)">&rsaquo;</button>
    </div>

    <!-- Day names across the top. Decorative: each button below says its own
         full date to a screen reader, so these are hidden from one. -->
    <div class="day-grid mb-2" aria-hidden="true">
      <span v-for="name in WEEKDAYS" :key="name" class="day-head">{{ name }}</span>
    </div>

    <!-- The month itself. A day outside min and max leaves a blank, so there
         is nothing there to press by mistake. -->
    <div class="day-grid">
      <template v-for="(week, index) in weeks" :key="index">
        <template v-for="cell in week" :key="cell.iso">
          <button v-if="cell.inMonth && !cell.tooEarly && !cell.tooLate" type="button"
            class="btn day-cell"
            :class="cell.iso === modelValue ? 'btn-primary' : 'btn-outline-secondary'"
            :aria-pressed="cell.iso === modelValue" :aria-label="cell.label"
            :data-testid="`day-${cell.iso}`" @click="emit('update:modelValue', cell.iso)">
            {{ cell.number }}
            <span v-if="cell.iso === todayISO" class="day-today">Today</span>
          </button>
          <span v-else class="day-cell day-blank" aria-hidden="true"></span>
        </template>
      </template>
    </div>

    <!-- In words as well, so the choice never rests on the colour of a button -->
    <p v-if="chosenLabel" class="mb-0 mt-3" data-testid="chosen-day">
      You have chosen <strong>{{ chosenLabel }}</strong>.
    </p>
    <p v-else class="page-subtitle mb-0 mt-3">Press the day you would like.</p>

  </div>
</template>
