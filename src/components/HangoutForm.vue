<script setup>
/*
  Propose a hangout                                      Owner: Clarence Tay
  Built like components/RequestForm.vue: an errors ref, checked on submit,
  then emit('save'). The page decides what to do with the result.

  WHERE TO MEET
  Two ways, because residents know their estate better than a search box does:
    - search OneMap for a place and press it, or
    - tap the map to put the pin exactly where you mean.
  Either way a pin appears. Seeing the pin, rather than only reading an
  address, is the point: someone who is not confident with maps can check they
  picked the right place before saving.

  The name is always editable. A search fills it in, a tap leaves it empty for
  the host to write, and OneMap's own names are sometimes unreadable
  ('PCF SPARKLETOTS PRESCHOOL @ EUNOS 134 (CC)'), so letting people fix it is
  kinder than forcing it.

  The form sends a NAME and COORDINATES, so a hangout always knows where it is
  without looking anything up. OneMap only indexes Singapore, and the database
  checks the coordinates again (schema.sql section 11).

  OUTDOORS is a switch, not something we guess. We cannot know whether an
  address someone searched for is outdoors, and it decides whether the rain
  warning from lib/weather.js is shown.

  The same rules are checked again in stores/hangout.js and in the database.
*/
import { ref, computed } from 'vue'
import { HANGOUT_DURATIONS } from '../stores/hangout.js'
import { todayISO, dateFromToday, TIME_OPTIONS, formatDuration, sessionStart } from '../lib/skillSwapFormat.js'
import HotspotMap from './HotspotMap.vue'
import DayPicker from './DayPicker.vue'

defineProps({
  submitLabel: { type: String, default: 'Propose hangout' },
})

const emit = defineEmits(['save'])

/*
  The day is picked from the calendar in components/DayPicker.vue, drawn on
  the page rather than handed to the browser, so the buttons can be as big as
  the rest of the app. FIRST_DAY and LAST_DAY keep it to the same two months a
  list would have offered, so nobody picks a day in the past or one too far
  ahead to plan.
*/
const FIRST_DAY = todayISO()
const LAST_DAY = dateFromToday(60)

const form = ref({
  title: '',
  description: '',
  placeName: '',
  latitude: null,
  longitude: null,
  outdoor: false,
  date: FIRST_DAY,
  time: '09:00',
  duration: 60,
})
const errors = ref({})

/*
  Take a message away the moment the person puts that field right, so a
  warning from an earlier press of the button never sits under a box that is
  now filled in. Every box calls this as it is typed in, and choosing a place
  on the map calls it too.
*/
function clearError(field) {
  errors.value[field] = ''
}

// A place picked from the OneMap search: it comes with a name
function onPlaceFound(place) {
  form.value.placeName = place.name
  form.value.latitude = place.lat
  form.value.longitude = place.lng
  clearError('place')
}

// A spot tapped on the map: coordinates only, so the host names it.
// An earlier search's name is cleared, or it would label the wrong place.
function onPlacePicked(point) {
  form.value.placeName = ''
  form.value.latitude = point.lat
  form.value.longitude = point.lng
  clearError('place')
}

// True once somewhere has been chosen, either way
const hasPoint = computed(() => Number.isFinite(form.value.latitude) && Number.isFinite(form.value.longitude))

function submit() {
  errors.value = {}

  if (form.value.title.trim().length < 5) errors.value.title = 'Please write at least 5 characters.'
  if (!hasPoint.value) {
    errors.value.place = 'Please choose where to meet: search for a place, or tap the map.'
  } else if (form.value.placeName.trim().length < 3) {
    // The database asks for at least 3 letters too (schema.sql section 11)
    errors.value.place = 'Please give this place a name, so neighbours know where to go.'
  }
  if (form.value.description.trim().length < 10) {
    errors.value.description = 'Please say a little more about the hangout (at least 10 characters).'
  }
  // A calendar box can be left empty or typed into by hand, so the day is
  // checked here as well as in stores/hangout.js and the database.
  if (!form.value.date) {
    errors.value.date = 'Please choose a day.'
  } else if (form.value.date > LAST_DAY) {
    errors.value.date = 'Please choose a day within the next two months.'
  } else if (sessionStart(form.value.date, form.value.time) < new Date()) {
    errors.value.date = 'That day and time have already passed.'
  }

  // Stop here if anything is wrong
  if (Object.keys(errors.value).length > 0) return

  emit('save', {
    ...form.value,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    placeName: form.value.placeName.trim(),
  })
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <div class="card-body p-4 vstack gap-4">

      <div>
        <label for="title" class="form-label">Short name</label>
        <input id="title" v-model="form.title" type="text" class="form-control"
          :class="{ 'is-invalid': errors.title }" maxlength="80" placeholder="e.g. Morning walk at the park"
          @input="clearError('title')" />
        <div class="invalid-feedback">{{ errors.title }}</div>
      </div>

      <div>
        <HotspotMap label="Where shall we meet?" pickable
          hint="Search for a place, or tap the map to put the pin exactly where you mean."
          @select="onPlaceFound" @pick="onPlacePicked" />

        <!-- Shown once there is a pin. A search fills the name in; a tap on
             the map leaves it blank for the host to write. -->
        <div v-if="hasPoint" class="mt-3">
          <label for="place-name" class="form-label">What is this place called?</label>
          <input id="place-name" v-model="form.placeName" type="text" class="form-control"
            :class="{ 'is-invalid': errors.place }" maxlength="80"
            placeholder="e.g. the void deck of Blk 412" data-testid="chosen-place"
            @input="clearError('place')" />
          <div class="invalid-feedback">{{ errors.place }}</div>
          <div class="form-text">Neighbours will see this name, so make it easy to find.</div>
        </div>
        <div v-else-if="errors.place" class="invalid-feedback d-block" role="alert">{{ errors.place }}</div>
      </div>

      <div>
        <label for="description" class="form-label">What will you do?</label>
        <textarea id="description" v-model="form.description" rows="4" class="form-control"
          :class="{ 'is-invalid': errors.description }" maxlength="240"
          placeholder="e.g. A gentle walk and a chat. We stop whenever anyone needs a rest."
          @input="clearError('description')"></textarea>
        <div class="invalid-feedback">{{ errors.description }}</div>
      </div>

      <div class="form-check form-switch">
        <input id="outdoor" v-model="form.outdoor" type="checkbox" role="switch" class="form-check-input"
          data-testid="outdoor-switch" />
        <label for="outdoor" class="form-check-label">This hangout is outdoors</label>
        <div class="form-text">We will warn people if rain is expected nearby.</div>
      </div>

      <!--
        The calendar is always open, on a line of its own. Nothing pops up and
        nothing has to be aimed at: the month is simply there to press.
      -->
      <div role="group" aria-labelledby="date-label">
        <div id="date-label" class="form-label">Which day?</div>
        <DayPicker v-model="form.date" :min="FIRST_DAY" :max="LAST_DAY"
          :invalid="!!errors.date" @update:model-value="clearError('date')" />
        <div v-if="errors.date" class="invalid-feedback d-block" role="alert">{{ errors.date }}</div>
      </div>

      <div class="row g-3">
        <div class="col-sm-6">
          <label for="time" class="form-label">What time?</label>
          <select id="time" v-model="form.time" class="form-select" @change="clearError('date')">
            <option v-for="t in TIME_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label for="duration" class="form-label">How long?</label>
          <select id="duration" v-model="form.duration" class="form-select" data-testid="hangout-duration">
            <option v-for="d in HANGOUT_DURATIONS" :key="d" :value="d">{{ formatDuration(d) }}</option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <router-link to="/app/hangouts" class="btn btn-lg btn-outline-secondary">Cancel</router-link>
        <button type="submit" class="btn btn-lg btn-primary" data-testid="save-hangout">{{ submitLabel }}</button>
      </div>

    </div>
  </form>
</template>
