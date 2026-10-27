<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { categories, difficulties, durations, calcPoints, categoryClass } from '../lib/points.js'
import { useAuthStore } from '../stores/auth.js'
import ConfirmModal from './ConfirmModal.vue'


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

// A time in milliseconds -> 'YYYY-MM-DDTHH:mm' in local time, the format a datetime-local input uses
function toInputValue(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

const form = ref({
  title: props.request?.title ?? '',
  description: props.request?.description ?? '',
  category: props.request?.category ?? '',
  difficulty: props.request?.difficulty ?? 'Easy',
  duration: props.request?.duration ?? 30,
  neededAt: props.request ? toInputValue(props.request.neededAt) : '',
  location: props.request?.location ?? '',
  isPhysical: props.request?.isPhysical ?? false,
})
const errors = ref({})

// What the form started with, so Cancel only asks when something was changed
const startValues = JSON.stringify(form.value)
const changed = computed(() => JSON.stringify(form.value) !== startValues)
const confirmLeave = ref(false)

const earliest = toInputValue(Date.now())

const previewPoints = computed(() => calcPoints(form.value.difficulty, form.value.duration))
const alwaysPhysical = computed(() => ALWAYS_PHYSICAL.includes(form.value.category))

// The ids for aria-describedby, leaving out the ones that are not shown
const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined

// The fields in the order they appear, so focus goes to the first one with an error
const categoryGroup = ref(null)
const neededAtInput = ref(null)
const locationInput = ref(null)
const descriptionInput = ref(null)
const titleInput = ref(null)
const fieldOrder = [
  ['category', () => categoryGroup.value.querySelector('button')],
  ['neededAt', () => neededAtInput.value],
  ['location', () => locationInput.value],
  ['description', () => descriptionInput.value],
  ['title', () => titleInput.value],
]

async function submit() {
  errors.value = {}

  const title = form.value.title.trim()
  // Blank is fine (we make one), but a typed title needs at least 5 characters
  if (title && title.length < 5) errors.value.title = 'Please write at least 5 characters, or leave it blank.'
  if (!form.value.category) errors.value.category = 'Please choose a category.'
  if (form.value.description.trim().length < 10) errors.value.description = 'Please describe what you need (at least 10 characters).'

  // new Date('YYYY-MM-DDTHH:mm') reads the value as local time
  const neededAt = new Date(form.value.neededAt).getTime()
  if (!form.value.neededAt || Number.isNaN(neededAt)) errors.value.neededAt = 'Please choose the day and time you need help.'
  else if (neededAt < Date.now()) errors.value.neededAt = 'This time has already passed. Please choose a later time.'

  const location = form.value.location.trim()
  if (!location) errors.value.location = 'Please write where you need help, for example your block or the CC.'
  else if (location.length > 100) errors.value.location = 'Please keep the place to 100 characters or fewer.'


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

      <div>
        <label for="needed-at" class="form-label">When do you need help?</label>
        <input id="needed-at" ref="neededAtInput" v-model="form.neededAt" type="datetime-local" class="form-control"
          :class="{ 'is-invalid': errors.neededAt }" :min="earliest" required
          :aria-invalid="!!errors.neededAt" :aria-describedby="describedBy(errors.neededAt && 'needed-at-error')" />
        <div id="needed-at-error" class="invalid-feedback">{{ errors.neededAt }}</div>
      </div>

      <div>
        <label for="location" class="form-label">Where do you need help?</label>
        <div id="location-hint" class="form-text mt-0 mb-2">
          This is where you and your helper will meet. No need for your unit number.
        </div>
        <input id="location" ref="locationInput" v-model="form.location" type="text" class="form-control"
          :class="{ 'is-invalid': errors.location }" maxlength="100" placeholder="e.g. Eunos CC entrance"
          :aria-describedby="describedBy('location-hint', errors.location && 'location-error')"
          :aria-invalid="!!errors.location" required />
        <div id="location-error" class="invalid-feedback">{{ errors.location }}</div>
        <!-- Only copies the block in; the person can still change it -->
        <button v-if="auth.user?.block" type="button" class="btn btn-outline-secondary mt-2"
          @click="form.location = auth.user.block">Use my block</button>
      </div>

      <div>
        <label for="description" class="form-label">Details</label>
        <textarea id="description" ref="descriptionInput" v-model="form.description" rows="4" class="form-control"
          :class="{ 'is-invalid': errors.description }" :maxlength="DETAILS_MAX"
          :aria-invalid="!!errors.description"
          :aria-describedby="describedBy(errors.description && 'description-error', 'description-count')"></textarea>
        <div id="description-error" class="invalid-feedback">{{ errors.description }}</div>
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
        The helper earns <strong>⭐ {{ previewPoints }} points</strong> after you confirm the task is done.
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
