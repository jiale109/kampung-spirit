<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { categories, difficulties, durations, calcPoints, categoryClass } from '../lib/points.js'
import { todayISO, dateFromToday, toISO, sessionStart, formatTime, TIME_OPTIONS } from '../lib/skillSwapFormat.js'
import { useAuthStore } from '../stores/auth.js'
import { checkText } from '../lib/contentRules.js'
import ConfirmModal from './ConfirmModal.vue'
import HotspotMap from './HotspotMap.vue'
import DayPicker from './DayPicker.vue'


const props = defineProps({
  request: { type: Object, default: null },
  submitLabel: { type: String, default: 'Post request' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['save'])

const auth = useAuthStore()
const router = useRouter()

const ALWAYS_PHYSICAL = ['Lifting', 'Companion Walk']

const DETAILS_MAX = 240
const TITLE_MAX = 80

// The day is picked on the calendar in components/DayPicker.vue and the time from a list,
// the same as components/HangoutForm.vue: from today up to two months ahead
const FIRST_DAY = todayISO()
const LAST_DAY = dateFromToday(60)

// A saved time in milliseconds -> 'HH:mm' in local time, the value the time list uses
function toTime(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "Tech help: Please help me set up..." from the category and the start of the details.
// Cut at a word, at most 80 characters. Category and details are already checked, so it is
// always longer than the 5 characters the database needs.
function makeTitle(category, details) {
  const full = `${category} help: ${details.replace(/\s+/g, ' ')}`
  if (full.length <= TITLE_MAX) return full
  const cut = full.slice(0, TITLE_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > category.length + 6 ? cut.slice(0, lastSpace) : cut}…`
}

// A new request starts on the next time in the list that is still ahead today,
// or tomorrow at 9:00 am once today's last time has gone
const nextToday = TIME_OPTIONS.find((t) => sessionStart(FIRST_DAY, t.value) > new Date())
const firstFree = nextToday ? { date: FIRST_DAY, time: nextToday.value } : { date: dateFromToday(1), time: '09:00' }

const form = ref({
  title: props.request?.title ?? '',
  description: props.request?.description ?? '',
  category: props.request?.category ?? '',
  difficulty: props.request?.difficulty ?? 'Easy',
  duration: props.request?.duration ?? 30,
  date: props.request ? toISO(new Date(props.request.neededAt)) : firstFree.date,
  time: props.request ? toTime(props.request.neededAt) : firstFree.time,
  location: props.request?.location ?? '',
  // The pin for the place, chosen on the map the same way as components/HangoutForm.vue.
  // Older requests have none, so they start empty and the form asks for one.
  latitude: props.request?.latitude ?? null,
  longitude: props.request?.longitude ?? null,
  isPhysical: props.request?.isPhysical ?? false,
  // Help inside the requester's home. Under-18s cannot accept these (schema.sql, accept_help_request)
  atHome: props.request?.atHome ?? false,
})
const errors = ref({})

/*
  WHERE TO MEET (same idea as components/HangoutForm.vue)
  Search OneMap and press a place, or tap the map. Either way a pin appears,
  so the senior can see they picked the right spot. A search fills in the
  name; a tap leaves the name for the senior to write. The name box below
  the map is what helpers read, and stays editable ("Use my block" too).
*/
const savedPlace = props.request && Number.isFinite(props.request.latitude) ? [{
  // HotspotMap puts the name into the popup as HTML, so escape it
  name: `Saved place: ${escapeHtml(props.request.location)}`,
  latitude: props.request.latitude,
  longitude: props.request.longitude,
}] : []
const needsPin = props.request && savedPlace.length === 0

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// The name the last search filled in, so a tap on the map only clears that
// one (it would label the wrong place) and never something the senior typed
let searchedName = null

function setPin(lat, lng) {
  form.value.latitude = lat
  form.value.longitude = lng
  errors.value.place = ''
}

// A place picked from the OneMap search: it comes with a name
function onPlaceFound(place) {
  setPin(place.lat, place.lng)
  form.value.location = place.name.slice(0, 100)
  searchedName = form.value.location
  errors.value.location = ''
}

// A spot tapped on the map: coordinates only, so the senior names it
function onPlacePicked(point) {
  setPin(point.lat, point.lng)
  if (form.value.location === searchedName) form.value.location = ''
  searchedName = null
}

// Pressing the saved pin (when editing) chooses it again
function onSavedPlace(place) {
  setPin(place.latitude, place.longitude)
}

const hasPin = computed(() => Number.isFinite(form.value.latitude) && Number.isFinite(form.value.longitude))

// What the form started with, so Cancel only asks when something was changed
const startValues = JSON.stringify(form.value)
const changed = computed(() => JSON.stringify(form.value) !== startValues)
const confirmLeave = ref(false)

// A request saved at a time the list does not have (e.g. 7:15 am) keeps it as an extra choice,
// so editing shows the saved time instead of an empty box
const timeOptions = TIME_OPTIONS.some((t) => t.value === form.value.time)
  ? TIME_OPTIONS
  : [...TIME_OPTIONS, { value: form.value.time, label: formatTime(form.value.time) }]
      .sort((a, b) => a.value.localeCompare(b.value))

// The words the safety check reads: title, details and place together (the database checks the same)
const safetyCheck = computed(() =>
  checkText(`${form.value.title} ${form.value.description} ${form.value.location}`))

const previewPoints = computed(() => calcPoints(form.value.difficulty, form.value.duration))
const alwaysPhysical = computed(() => ALWAYS_PHYSICAL.includes(form.value.category))

// The ids for aria-describedby, leaving out the ones that are not shown
const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined

// The fields in the order they appear, so focus goes to the first one with an error
const categoryGroup = ref(null)
const dayGroup = ref(null)
const placeGroup = ref(null)
const locationInput = ref(null)
const descriptionInput = ref(null)
const titleInput = ref(null)
const fieldOrder = [
  ['category', () => categoryGroup.value.querySelector('button')],
  ['neededAt', () => dayGroup.value],
  ['place', () => placeGroup.value.querySelector('#place-search')],
  ['location', () => locationInput.value],
  ['description', () => descriptionInput.value],
  // A blocked phrase can be in any of the three boxes, but the message shows on Details
  ['safety', () => descriptionInput.value],
  ['title', () => titleInput.value],
]

async function submit() {
  errors.value = {}

  const title = form.value.title.trim()
  // Blank is fine (we make one), but a typed title needs at least 5 characters
  if (title && title.length < 5) errors.value.title = 'Please write at least 5 characters, or leave it blank.'
  if (!form.value.category) errors.value.category = 'Please choose a category.'
  if (form.value.description.trim().length < 10) errors.value.description = 'Please describe what you need (at least 10 characters).'

  // The day and time together, in local time, as milliseconds (what the store expects)
  const neededAt = form.value.date ? sessionStart(form.value.date, form.value.time).getTime() : null
  if (!form.value.date) errors.value.neededAt = 'Please choose the day you need help.'
  else if (neededAt < Date.now()) errors.value.neededAt = 'This time has already passed. Please choose a later time.'
  else if (form.value.date > LAST_DAY) errors.value.neededAt = 'Please choose a day within the next two months.'

  if (!hasPin.value) errors.value.place = 'Please choose where to meet: search for a place, or tap the map.'

  const location = form.value.location.trim()
  if (!location) errors.value.location = 'Please write where you need help, for example your block or the CC.'
  else if (location.length > 100) errors.value.location = 'Please keep the place to 100 characters or fewer.'

  const [blocked] = safetyCheck.value.blocked
  if (blocked) errors.value.safety = `For everyone's safety, requests cannot include "${blocked}". Please change it and try again.`
  else if (safetyCheck.value.contact.length) errors.value.safety = 'Please keep contact details out of requests. Talk through the app instead.'

  if (Object.keys(errors.value).length > 0) {
    await nextTick()
    const first = fieldOrder.find(([key]) => errors.value[key])
    first[1]()?.focus()
    return
  }

  const description = form.value.description.trim()
  emit('save', {
    ...form.value,
    title: title || makeTitle(form.value.category, description),
    description,
    location,
    neededAt,
  })
}

function cancel() {
  if (changed.value) confirmLeave.value = true
  else router.push('/app/requests')
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <div class="card-body p-4 d-grid gap-4">

      <p class="alert alert-light safety-tip mb-0" data-testid="safety-tip">
        Stay safe: meet in a place you are comfortable with. Never share your OTP, passwords or bank details.
      </p>

      <div ref="categoryGroup" role="group" aria-labelledby="category-label"
        :aria-invalid="!!errors.category" :aria-describedby="describedBy(errors.category && 'category-error')">
        <div id="category-label" class="form-label">Category</div>
        <div class="row row-cols-1 row-cols-sm-2 g-2">
          <div v-for="c in categories" :key="c.name" class="col">
            <button type="button" class="btn choice-tile w-100" :class="[categoryClass(c.name), { active: form.category === c.name }]"
              :aria-pressed="form.category === c.name" @click="form.category = c.name">
              <span class="category-icon" aria-hidden="true">{{ c.icon }}</span> {{ c.name }}
            </button>
          </div>
        </div>
        <div v-if="errors.category" id="category-error" class="invalid-feedback d-block" role="alert">{{ errors.category }}</div>
      </div>

      <div>
        <p v-if="alwaysPhysical" class="mb-0" data-testid="always-physical">This task needs physical effort.</p>
        <div v-else class="form-check physical-check">
          <input id="is-physical" v-model="form.isPhysical" type="checkbox" class="form-check-input" />
          <label for="is-physical" class="form-check-label">This needs physical effort (for example lifting or a long walk)</label>
        </div>
      </div>

      <div role="group" aria-labelledby="needed-at-label" class="d-grid gap-3">
        <div id="needed-at-label" class="form-label mb-0">When do you need help?</div>

        <!-- Focused (and scrolled to) when the day or time has an error -->
        <div ref="dayGroup" role="group" aria-labelledby="date-label" tabindex="-1"
          :aria-invalid="!!errors.neededAt" :aria-describedby="describedBy(errors.neededAt && 'needed-at-error')">
          <div id="date-label" class="form-label">Which day?</div>
          <DayPicker v-model="form.date" :min="FIRST_DAY" :max="LAST_DAY"
            :invalid="!!errors.neededAt" @update:model-value="errors.neededAt = ''" />
          <div v-if="errors.neededAt" id="needed-at-error" class="invalid-feedback d-block" role="alert">{{ errors.neededAt }}</div>
        </div>

        <div class="row g-3">
          <div class="col-sm-6">
            <label for="time" class="form-label">What time?</label>
            <select id="time" v-model="form.time" class="form-select" :class="{ 'is-invalid': errors.neededAt }"
              :aria-invalid="!!errors.neededAt" :aria-describedby="describedBy(errors.neededAt && 'needed-at-error')"
              @change="errors.neededAt = ''">
              <option v-for="t in timeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <div ref="placeGroup" role="group" aria-labelledby="where-label" aria-describedby="location-hint">
        <div id="where-label" class="form-label">Where do you need help?</div>
        <div id="location-hint" class="form-text mt-0 mb-3">
          This is where you and your helper will meet. No need for your unit number.
        </div>
        <p v-if="needsPin" class="mb-3" data-testid="needs-pin">
          This request has no pin on the map yet. Please choose the place on the map before saving.
        </p>

        <HotspotMap label="Find the place" pickable :places="savedPlace"
          hint="Search for a place, or tap the map to put the pin exactly where you mean."
          @select="onPlaceFound" @pick="onPlacePicked" @marker="onSavedPlace" />
        <div v-if="errors.place" id="place-error" class="invalid-feedback d-block" role="alert"
          data-testid="place-error">{{ errors.place }}</div>
        <p v-if="hasPin" class="form-text mb-0" data-testid="pin-chosen">A pin is on the map for this place.</p>

        <label for="location" class="form-label mt-3">What is this place called?</label>
        <input id="location" ref="locationInput" v-model="form.location" type="text" class="form-control"
          :class="{ 'is-invalid': errors.location }" maxlength="100" placeholder="e.g. Eunos CC entrance"
          :aria-describedby="describedBy('location-name-hint', errors.location && 'location-error')"
          :aria-invalid="!!errors.location" required @input="errors.location = ''" />
        <div id="location-error" class="invalid-feedback">{{ errors.location }}</div>
        <div id="location-name-hint" class="form-text">Your helper will see this name, so make it easy to find.</div>
        <!-- Only copies the block in; the person can still change it -->
        <button v-if="auth.user?.block" type="button" class="btn btn-outline-secondary mt-2"
          @click="form.location = auth.user.block; form.atHome = true; errors.location = ''">Use my address</button>
        <!-- "Use my address" ticks this; the person can untick it, e.g. to meet downstairs -->
        <div class="form-check physical-check mt-2">
          <input id="at-home" v-model="form.atHome" type="checkbox" class="form-check-input" />
          <label for="at-home" class="form-check-label">This help is inside my home</label>
        </div>
      </div>

      <div>
        <label for="description" class="form-label">Details</label>
        <textarea id="description" ref="descriptionInput" v-model="form.description" rows="4" class="form-control"
          :class="{ 'is-invalid': errors.description || errors.safety }" :maxlength="DETAILS_MAX"
          :aria-invalid="!!(errors.description || errors.safety)"
          :aria-describedby="describedBy((errors.description || errors.safety) && 'description-error', 'description-count')"></textarea>
        <div id="description-error" class="invalid-feedback" data-testid="description-error">
          {{ errors.description || errors.safety }}
        </div>
        <div id="description-count" class="form-text" data-testid="details-count">
          {{ form.description.length }} / {{ DETAILS_MAX }}
        </div>
      </div>

      <div class="row g-3">
        <div class="col-sm-6">
          <label for="duration" class="form-label">How long?</label>
          <select id="duration" v-model="form.duration" class="form-select">
            <option v-for="d in durations" :key="d" :value="d">{{ d }} min</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label for="difficulty" class="form-label">How hard?</label>
          <select id="difficulty" v-model="form.difficulty" class="form-select">
            <option v-for="(weight, name) in difficulties" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </div>

      <p class="points-note">
        The helper earns <strong><img src="/images/coin.svg" class="point-coin-img" alt="" /> {{ previewPoints }} points</strong> after you confirm the task is done.
      </p>

      <div>
        <label for="title" class="form-label">Short title (optional)</label>
        <div id="title-optional-hint" class="form-text mt-0 mb-2">Leave blank and we will make one for you.</div>
        <input id="title" ref="titleInput" v-model="form.title" type="text" class="form-control"
          :class="{ 'is-invalid': errors.title }" :maxlength="TITLE_MAX" placeholder="e.g. Help me set up Singpass"
          :aria-invalid="!!errors.title"
          :aria-describedby="describedBy('title-optional-hint', form.category === 'Other' && 'title-hint', errors.title && 'title-error')" />
        <div id="title-error" class="invalid-feedback">{{ errors.title }}</div>
        <div v-if="form.category === 'Other'" id="title-hint" class="form-text">
          Say clearly what you need in the title, for example 'Change a light bulb'.
        </div>
      </div>

      <!-- Allowed, but a calm reminder while the text mentions passwords, OTPs, money and so on -->
      <p v-if="safetyCheck.warnings.length && !safetyCheck.blocked.length" class="alert alert-light safety-tip mb-0"
        role="status" data-testid="safety-reminder">
        Reminder: never share your Singpass password, OTP, PIN or bank details with a helper.
        Helpers will never ask you for money.
      </p>

      <div class="form-actions">
        <button type="button" class="btn btn-lg btn-outline-secondary" @click="cancel">Cancel</button>
        <button type="submit" class="btn btn-lg btn-primary" :disabled="busy">{{ busy ? 'Saving…' : submitLabel }}</button>
      </div>
    </div>

    <ConfirmModal v-if="confirmLeave" title="Leave without saving?" message="Your changes will be lost."
      confirm-label="Leave" cancel-label="Keep editing" danger testid="confirm-leave"
      @confirm="router.push('/app/requests')" @cancel="confirmLeave = false" />
  </form>
</template>

<style scoped>
/* Safety tips: small and calm, not a warning */
.safety-tip {
  font-size: 0.95rem;
  border-color: var(--bs-border-color);
}

/* Bootstrap's checkbox is small; make it and its label easier to tap */
.physical-check {
  display: flex;
  align-items: center;
  min-height: 3rem;
}

.physical-check .form-check-input {
  width: 1.4rem;
  height: 1.4rem;
  margin-top: 0;
  flex-shrink: 0;
}

.physical-check .form-check-label {
  padding-left: 0.4rem;
}
</style>
