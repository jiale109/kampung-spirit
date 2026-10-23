<script setup>
/*
  Propose a hangout                                      Owner: Clarence Tay
  Built like components/RequestForm.vue: an errors ref, checked on submit,
  then emit('save'). The page decides what to do with the result.
  The same rules are checked again in stores/hangout.js and in the database.
*/
import { ref } from 'vue'
import { hotspots } from '../lib/hotspots.js'
import { HANGOUT_DURATIONS } from '../stores/hangout.js'
import { dateOptions, TIME_OPTIONS, formatDuration } from '../lib/skillSwapFormat.js'

defineProps({
  submitLabel: { type: String, default: 'Propose hangout' },
})

const emit = defineEmits(['save'])

const days = dateOptions(60)

const form = ref({
  title: '',
  description: '',
  hotspotId: '',
  date: days[0].value,
  time: '09:00',
  duration: 60,
})
const errors = ref({})

function submit() {
  errors.value = {}

  if (form.value.title.trim().length < 5) errors.value.title = 'Please write at least 5 characters.'
  if (!form.value.hotspotId) errors.value.hotspotId = 'Please choose where to meet.'
  if (form.value.description.trim().length < 10) {
    errors.value.description = 'Please say a little more about the hangout (at least 10 characters).'
  }

  // Stop here if anything is wrong
  if (Object.keys(errors.value).length > 0) return

  emit('save', {
    ...form.value,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
  })
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <div class="card-body p-4 vstack gap-4">

      <div>
        <label for="title" class="form-label">Short name</label>
        <input id="title" v-model="form.title" type="text" class="form-control"
          :class="{ 'is-invalid': errors.title }" maxlength="80" placeholder="e.g. Morning walk at the park" />
        <div class="invalid-feedback">{{ errors.title }}</div>
      </div>

      <div>
        <label for="hotspot" class="form-label">Where shall we meet?</label>
        <select id="hotspot" v-model="form.hotspotId" class="form-select"
          :class="{ 'is-invalid': errors.hotspotId }">
          <option value="">Choose a place</option>
          <option v-for="h in hotspots" :key="h.id" :value="h.id">
            {{ h.name }}<template v-if="h.outdoor"> (outdoors)</template>
          </option>
        </select>
        <div class="invalid-feedback">{{ errors.hotspotId }}</div>
      </div>

      <div>
        <label for="description" class="form-label">What will you do?</label>
        <textarea id="description" v-model="form.description" rows="4" class="form-control"
          :class="{ 'is-invalid': errors.description }" maxlength="240"
          placeholder="e.g. A gentle walk and a chat. We stop whenever anyone needs a rest."></textarea>
        <div class="invalid-feedback">{{ errors.description }}</div>
      </div>

      <div class="row g-3">
        <div class="col-sm-6">
          <label for="date" class="form-label">Which day?</label>
          <select id="date" v-model="form.date" class="form-select">
            <option v-for="d in days" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label for="time" class="form-label">What time?</label>
          <select id="time" v-model="form.time" class="form-select">
            <option v-for="t in TIME_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
      </div>

      <div>
        <label for="duration" class="form-label">How long?</label>
        <select id="duration" v-model="form.duration" class="form-select">
          <option v-for="d in HANGOUT_DURATIONS" :key="d" :value="d">{{ formatDuration(d) }}</option>
        </select>
      </div>

      <div class="form-actions">
        <router-link to="/app/hangouts" class="btn btn-lg btn-outline-secondary">Cancel</router-link>
        <button type="submit" class="btn btn-lg btn-primary" data-testid="save-hangout">{{ submitLabel }}</button>
      </div>

    </div>
  </form>
</template>
