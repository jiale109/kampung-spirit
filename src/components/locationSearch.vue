<script setup>
/*
  Search OneMap for a place                              Owner: Clarence Tay
  A box, a Search button, and the places OneMap sends back. Pressing one
  emits it to the parent:
      emit('select', { name, address, postal, lat, lng })

  A button rather than searching as you type: it keeps the number of API
  calls low, and a list that changes while a senior is still typing is hard
  to follow. One clear action per screen.
*/
import { ref } from 'vue'
import { searchAddress } from '../lib/onemap.js'

defineProps({
  label: { type: String, default: 'Find a place' },
})

const emit = defineEmits(['select'])

const query = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)

async function search() {
  if (!query.value.trim()) return
  searching.value = true
  results.value = await searchAddress(query.value)
  searching.value = false
  searched.value = true
}

function choose(place) {
  results.value = []
  searched.value = false
  query.value = place.name
  emit('select', place)
}
</script>

<template>
  <div>
    <label for="place-search" class="form-label">{{ label }}</label>
    <div class="row g-2">
      <div class="col">
        <input id="place-search" v-model="query" type="text" class="form-control"
          placeholder="e.g. Eunos Community Club" data-testid="place-search"
          @keyup.enter="search" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-primary" :disabled="searching"
          data-testid="place-search-go" @click="search">
          {{ searching ? 'Searching...' : 'Search' }}
        </button>
      </div>
    </div>

    <ul v-if="results.length > 0" class="list-group mt-3" data-testid="place-results">
      <li v-for="place in results" :key="place.address + place.lat" class="list-group-item">
        <button type="button" class="btn btn-link p-0 text-start" @click="choose(place)">
          <strong>{{ place.name }}</strong><br />
          <span class="page-subtitle">{{ place.address }}</span>
        </button>
      </li>
    </ul>

    <p v-else-if="searched && !searching" class="mt-3 mb-0">
      No places found. Try part of the name, like "eunos".
    </p>
  </div>
</template>
