<script setup>
/*
  "Where to meet" modal for one help request.
  Looks up the request's place with OneMap (lib/onemap.js) when it opens and
  shows the best match on a small map. The place is always written in words
  too, so the modal is still useful when OneMap finds nothing or is down.

  Show it with v-if: the map is removed when the modal closes, so opening it
  again builds a fresh one.
*/
import { ref, onMounted, onUnmounted, nextTick, useId } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchAddress } from '../lib/onemap.js'

const props = defineProps({
  location: { type: String, required: true },
})

const emit = defineEmits(['close'])

// Copied from HotspotMap.vue (Clarence's file). OneMap requires this attribution.
const TILES = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">OneMap</a> &copy; contributors | ' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener">Singapore Land Authority</a>'

const titleId = useId()
const closeButton = ref(null)
const mapEl = ref(null)

const searching = ref(true)
const place = ref(null)   // the first OneMap result, or null when nothing matched
let map = null
let closed = false

// Escape closes the modal, like the close button
function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

// Move focus into the modal, and give it back to where it was when the modal closes
let previousFocus = null
onMounted(async () => {
  previousFocus = document.activeElement
  closeButton.value.focus()
  document.addEventListener('keydown', onKeydown)

  const results = await searchAddress(props.location + ' Singapore')
  if (closed) return   // closed before OneMap answered
  place.value = results[0] ?? null
  searching.value = false

  // The map's box only exists once Vue has drawn the result
  if (!place.value) return
  await nextTick()
  if (closed) return
  showMap(place.value)
})

onUnmounted(() => {
  closed = true
  document.removeEventListener('keydown', onKeydown)
  if (map) map.remove()
  map = null
  previousFocus?.focus?.()
})

function showMap({ lat, lng }) {
  map = L.map(mapEl.value, {
    center: [lat, lng],
    zoom: 17,
    minZoom: 11,
    maxZoom: 19,
    scrollWheelZoom: false, // so the page still scrolls normally on a phone
  })
  L.tileLayer(TILES, { minZoom: 11, maxZoom: 19, attribution: ATTRIBUTION }).addTo(map)

  // Same circle as HotspotMap.vue: no pin image needed
  L.circleMarker([lat, lng], {
    radius: 10,
    weight: 3,
    color: '#0b6e6e',
    fillColor: '#ffffff',
    fillOpacity: 1,
  }).addTo(map)
}
</script>

<template>
  <div>
    <div class="modal show" style="display: block;" role="dialog" aria-modal="true"
      :aria-labelledby="titleId" @click.self="emit('close')">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">Where to meet</h2>
            <button ref="closeButton" type="button" class="btn-close map-close" aria-label="Close"
              @click="emit('close')"></button>
          </div>
          <div class="modal-body vstack gap-3">
            <p class="m-0" data-testid="map-location"><strong>Meeting place:</strong> {{ location }}</p>

            <p v-if="searching" class="m-0" role="status">Finding the place…</p>

            <template v-else-if="place">
              <div ref="mapEl" class="request-map" role="region" :aria-label="`Map showing ${place.name}`"
                data-testid="request-map"></div>
              <div data-testid="map-match">
                <p class="m-0 fw-bold">{{ place.name }}</p>
                <p class="m-0">{{ place.address }}</p>
              </div>
              <p class="m-0">This is our best match. Please check the details with the requester.</p>
            </template>

            <p v-else class="m-0" role="status" data-testid="map-not-found">
              We could not find this place on the map. The meeting place is: {{ location }}.
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  </div>
</template>

<style scoped>
.request-map {
  height: 18rem;
  border-radius: 0.75rem;
}

/* Big enough to tap (48px) */
.map-close {
  min-width: 3rem;
  min-height: 3rem;
}
</style>
