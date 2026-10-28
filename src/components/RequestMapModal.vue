<script setup>
/*
  "Where to meet" modal for one help request.
  Shows the pin the requester chose on the form (components/RequestForm.vue)
  on a small map, with the place written in words too. Nothing is looked up:
  the coordinates are saved on the request.

  Older requests have no pin. Then the modal only says the meeting place in
  words, with no map.

  Show it with v-if: the map is removed when the modal closes, so opening it
  again builds a fresh one.
*/
import { ref, onMounted, onUnmounted, useId } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  location: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
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

const hasPin = Number.isFinite(props.latitude) && Number.isFinite(props.longitude)
let map = null

// Escape closes the modal, like the close button
function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

// Move focus into the modal, and give it back to where it was when the modal closes
let previousFocus = null
onMounted(() => {
  previousFocus = document.activeElement
  closeButton.value.focus()
  document.addEventListener('keydown', onKeydown)
  if (hasPin) showMap()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (map) map.remove()
  map = null
  previousFocus?.focus?.()
})

function showMap() {
  const where = [props.latitude, props.longitude]
  map = L.map(mapEl.value, {
    center: where,
    zoom: 17,
    minZoom: 11,
    maxZoom: 19,
    scrollWheelZoom: false, // so the page still scrolls normally on a phone
  })
  L.tileLayer(TILES, { minZoom: 11, maxZoom: 19, attribution: ATTRIBUTION }).addTo(map)

  // Same circle as HotspotMap.vue: no pin image needed. The popup is built as
  // text, not HTML, because the name was typed by the requester.
  const name = document.createElement('strong')
  name.textContent = props.location
  L.circleMarker(where, {
    radius: 10,
    weight: 3,
    color: '#0b6e6e',
    fillColor: '#ffffff',
    fillOpacity: 1,
  }).addTo(map).bindPopup(name).openPopup()
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
            <p class="m-0" data-testid="map-location"><strong>Meeting place:</strong> {{ location }}.</p>

            <div v-if="hasPin" ref="mapEl" class="request-map" role="region" :aria-label="`Map showing ${location}`"
              data-testid="request-map"></div>
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
