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
        <!-- keydown and prevent, not keyup: this box sits inside the propose
             form, and Enter in a text box submits the form it is in. Without
             this, searching for a place would send the whole form. -->
        <input id="place-search" v-model="query" type="text" class="form-control"
          placeholder="e.g. Eunos Community Club" data-testid="place-search"
          @keydown.enter.prevent="search" />
      </div>
      <div class="col-auto">
        <!-- h-100 so the button matches the height of the box beside it -->
        <button type="button" class="btn btn-primary h-100" :disabled="searching"
          data-testid="place-search-go" @click="search">
          {{ searching ? 'Searching...' : 'Search' }}
        </button>
      </div>
    </div>

    <template v-if="results.length > 0">
      <p class="page-subtitle mt-3 mb-2">
        {{ results.length === 1 ? '1 place found' : `${results.length} places found` }}.
        Press the one you mean.
      </p>

      <!--
        Bootstrap's actionable list group: the BUTTON is the row, rather than
        a button inside a row. That matters here, because theme.css makes
        every .btn a flex box, which laid the name and the address side by
        side and ignored the line break between them.
      -->
      <div class="list-group place-results" data-testid="place-results">
        <button v-for="place in results" :key="place.address + place.lat" type="button"
          class="list-group-item list-group-item-action place-result" @click="choose(place)">
          <span class="place-result-name">{{ place.name }}</span>
          <!-- OneMap repeats the name as the address for parks and the like,
               and the same line twice reads as a mistake -->
          <span v-if="place.address && place.address !== place.name"
            class="place-result-address">{{ place.address }}</span>
        </button>
      </div>
    </template>

    <p v-else-if="searched && !searching" class="place-empty mt-3 mb-0">
      No places found. Try part of the name, like &ldquo;eunos&rdquo;.
    </p>
  </div>
</template>
