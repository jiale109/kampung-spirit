<script setup>
import { ref, computed } from 'vue'
import { categories, difficulties, durations, calcPoints, categoryClass } from '../lib/points.js'


const props = defineProps({
  request: { type: Object, default: null },
  submitLabel: { type: String, default: 'Post request' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['save'])

// A time in milliseconds -> 'YYYY-MM-DDTHH:mm' in local time, the format a datetime-local input uses
function toInputValue(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = ref({
  title: props.request?.title ?? '',
  description: props.request?.description ?? '',
  category: props.request?.category ?? '',
  difficulty: props.request?.difficulty ?? 'Easy',
  duration: props.request?.duration ?? 30,
  neededAt: props.request ? toInputValue(props.request.neededAt) : '',
})
const errors = ref({})

const earliest = toInputValue(Date.now())

const previewPoints = computed(() => calcPoints(form.value.difficulty, form.value.duration))

function submit() {
  errors.value = {}

  if (form.value.title.trim().length < 5) errors.value.title = 'Please write at least 5 characters.'
  if (!form.value.category) errors.value.category = 'Please choose a category.'
  if (form.value.description.trim().length < 10) errors.value.description = 'Please describe what you need (at least 10 characters).'

  // new Date('YYYY-MM-DDTHH:mm') reads the value as local time
  const neededAt = new Date(form.value.neededAt).getTime()
  if (!form.value.neededAt || Number.isNaN(neededAt)) errors.value.neededAt = 'Please choose the day and time you need help.'
  else if (neededAt < Date.now()) errors.value.neededAt = 'This time has already passed. Please choose a later time.'


  if (Object.keys(errors.value).length > 0) return

  emit('save', {
    ...form.value,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    neededAt,
  })
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <div class="card-body p-4 d-grid gap-4">

      <div>
        <label for="title" class="form-label">Short title</label>
        <input id="title" v-model="form.title" type="text" class="form-control"
          :class="{ 'is-invalid': errors.title }" maxlength="80" placeholder="e.g. Help me set up Singpass" />
        <div class="invalid-feedback">{{ errors.title }}</div>
      </div>

      <div role="group" aria-labelledby="category-label">
        <div id="category-label" class="form-label">Category</div>
        <div class="row row-cols-1 row-cols-sm-2 g-2">
          <div v-for="c in categories" :key="c.name" class="col">
            <button type="button" class="btn choice-tile w-100" :class="[categoryClass(c.name), { active: form.category === c.name }]"
              :aria-pressed="form.category === c.name" @click="form.category = c.name">
              <span class="category-icon" aria-hidden="true">{{ c.icon }}</span> {{ c.name }}
            </button>
          </div>
        </div>
        <div v-if="errors.category" class="invalid-feedback d-block" role="alert">{{ errors.category }}</div>
      </div>

      <div>
        <label for="description" class="form-label">Details</label>
        <textarea id="description" v-model="form.description" rows="4" class="form-control"
          :class="{ 'is-invalid': errors.description }" maxlength="240"></textarea>
        <div class="invalid-feedback">{{ errors.description }}</div>
      </div>

      <div>
        <label for="needed-at" class="form-label">When do you need help?</label>
        <input id="needed-at" v-model="form.neededAt" type="datetime-local" class="form-control"
          :class="{ 'is-invalid': errors.neededAt }" :min="earliest" required />
        <div class="invalid-feedback">{{ errors.neededAt }}</div>
      </div>

      <div class="row g-3">
        <div class="col-sm-6">
          <label for="difficulty" class="form-label">How hard?</label>
          <select id="difficulty" v-model="form.difficulty" class="form-select">
            <option v-for="(weight, name) in difficulties" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label for="duration" class="form-label">How long?</label>
          <select id="duration" v-model="form.duration" class="form-select">
            <option v-for="d in durations" :key="d" :value="d">{{ d }} min</option>
          </select>
        </div>
      </div>

      <p class="points-note">
        The helper earns <strong><img src="/images/coin.svg" class="point-coin-img" alt="" /> {{ previewPoints }} points</strong> after you confirm the task is done.
      </p>

      <div class="form-actions">
        <router-link to="/app/requests" class="btn btn-lg btn-outline-secondary">Cancel</router-link>
        <button type="submit" class="btn btn-lg btn-primary" :disabled="busy">{{ busy ? 'Saving…' : submitLabel }}</button>
      </div>
    </div>
  </form>
</template>
