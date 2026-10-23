<script setup>
/*
  Map of the estate hotspots                             Owner: Clarence Tay
  Leaflet showing OneMap's tiles, one marker per hotspot from lib/hotspots.js,
  plus a OneMap search box that moves the map to whatever you look up.

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
import { hotspots } from '../lib/hotspots.js'
import LocationSearch from './locationSearch.vue'

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
  for (const h of hotspots) {
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

  // Fit the map around the hotspots, so it works wherever they are
  if (markers.length > 0) {
    map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [30, 30], maxZoom: 16 })
  }
})

onUnmounted(() => {
  if (map) map.remove()
  map = null
})

// A place picked from the OneMap search: move there and mark it
function goTo(place) {
  if (!map) return
  if (searchMarker) searchMarker.remove()
  searchMarker = L.circleMarker([place.lat, place.lng], {
    radius: 10,
    weight: 3,
    color: '#b45309',
    fillColor: '#ffffff',
    fillOpacity: 1,
  }).addTo(map)
  searchMarker.bindPopup(`<strong>${place.name}</strong>`).openPopup()
  map.setView([place.lat, place.lng], 17)
}
</script>

<template>
  <div class="card mb-4">
    <div class="card-body p-4 vstack gap-3">
      <h2 class="page-title fs-4">Where we meet</h2>
      <LocationSearch @select="goTo" />
      <div ref="mapEl" style="height: 420px; border-radius: 0.75rem;" data-testid="hotspot-map"></div>
    </div>
  </div>
</template>
