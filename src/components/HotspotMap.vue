<script setup>
/*
  Map of places                                          Owner: Clarence Tay
  Leaflet showing OneMap's tiles, a marker for each place passed in, and a
  OneMap search box above it that moves the map to whatever you look up and
  tells the parent which place was picked.

  It is both the map on the Hangouts list and the place picker on the propose
  form. Searching and then SEEING the pin is much clearer than reading an
  address, which matters for residents who are not confident with maps.

  Circle markers are used instead of Leaflet's pin image on purpose: the pin
  is a PNG that Leaflet loads by a relative path, which breaks under Vite.
  A circle needs no image at all, and the colour is backed up by a popup with
  the name, so the map never relies on colour alone.

  OneMap tiles: zoom 11 to 19, Singapore only, and the attribution below is
  required when you show them. Check it against https://www.onemap.gov.sg/apidocs
  if the tiles ever stop loading.
*/
import { ref, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import LocationSearch from './locationSearch.vue'

/*
*/
const props = defineProps({
  // Markers to draw. Each needs { name, latitude, longitude }. The Hangouts
  // page passes the places that have hangouts; the propose form passes none,
  // because the only pin there is the one you search for.
  places: { type: Array, default: () => [] },
  // Shown above the search box, e.g. 'Where shall we meet?'
  label: { type: String, default: 'Find a place' },
  // true on the propose form: tapping the map drops the pin there
  pickable: { type: Boolean, default: false },
})

/*
  select: a place chosen from the OneMap search, with a name.
  pick:   a spot tapped on the map. There is no name for it, because reading
          a name back from coordinates needs OneMap's reverse geocode, which
          needs a token, and tokens last about 3 days. The form asks the host
          to name the spot instead, which also reads better than OneMap's own
          names for some buildings.
*/
const emit = defineEmits(['select', 'pick'])

// 'Default' is the colour map. 'Grey_HD' is the quieter grey one.
const TILES = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">OneMap</a> &copy; contributors | ' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener">Singapore Land Authority</a>'
const SINGAPORE = [[1.16, 103.502], [1.5607, 104.1147]]

const mapEl = ref(null)
let map = null
let searchMarker = null

onMounted(() => {
  map = L.map(mapEl.value, {
    center: [1.3326, 103.9152],
    zoom: 15,
    minZoom: 11,
    maxZoom: 19,
    maxBounds: SINGAPORE,
    scrollWheelZoom: false, // so the page still scrolls normally on a phone
  })

  L.tileLayer(TILES, { minZoom: 11, maxZoom: 19, attribution: ATTRIBUTION }).addTo(map)

  const markers = []
  for (const h of props.places) {
    const marker = L.circleMarker([h.latitude, h.longitude], {
      radius: 10,
      weight: 3,
      color: '#0b6e6e',
      fillColor: '#ffffff',
      fillOpacity: 1,
    }).addTo(map)
    marker.bindPopup(`<strong>${h.name}</strong>`)
    markers.push(marker)
  }

  // Fit the map around the markers, so it works wherever they are
  if (markers.length > 0) {
    map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [30, 30], maxZoom: 16 })
  }

  // Tap anywhere to put the pin there, for someone who knows the spot but
  // cannot name it the way OneMap does. The search box stays for anyone using
  // a keyboard, who cannot tap a map.
  if (props.pickable) {
    map.on('click', (e) => {
      dropPin(e.latlng.lat, e.latlng.lng, 'Your chosen spot')
      emit('pick', { lat: e.latlng.lat, lng: e.latlng.lng })
    })
  }
})

onUnmounted(() => {
  if (map) map.remove()
  map = null
})

// The one amber pin for the place being chosen. Dropping a new one removes
// the old, so there is never more than a single chosen spot.
function dropPin(lat, lng, label) {
  if (!map) return
  if (searchMarker) searchMarker.remove()
  searchMarker = L.circleMarker([lat, lng], {
    radius: 10,
    weight: 3,
    color: '#b45309',
    fillColor: '#ffffff',
    fillOpacity: 1,
  }).addTo(map)
  searchMarker.bindPopup(`<strong>${label}</strong>`).openPopup()
}

// A place picked from the OneMap search: move there and mark it
function goTo(place) {
  if (!map) return
  dropPin(place.lat, place.lng, place.name)
  map.setView([place.lat, place.lng], 17)
  emit('select', place)
}
</script>

<template>
  <div class="vstack gap-3">
    <LocationSearch :label="label" @select="goTo" />
    <p v-if="pickable" class="page-subtitle mb-0">
      Search for a place, or tap the map to put the pin exactly where you mean.
    </p>
    <div ref="mapEl" style="height: 420px; border-radius: 0.75rem;" data-testid="hotspot-map"></div>
  </div>
</template>
