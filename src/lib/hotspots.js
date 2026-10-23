/*
  GUIDE (Owner: Clarence Tay): the estate hotspots hangouts can be held at.

  Hotspots almost never change, so a plain file is enough - no table needed.
  stores/hangout.js saves only the hotspot id on a hangout row, and the page
  looks the rest up here.

    id          saved on the hangout row. Never rename one that is in use.
    name        shown to residents.
    latitude    for the OneMap map marker (a number, not a string).
    longitude   same.
    outdoor     true if rain matters. Only these get a weather warning.
    weatherArea the data.gov.sg 2-hour forecast area to read. It must match
                one of their area names exactly, e.g. 'Geylang', 'Bedok',
                'Paya Lebar'. See lib/weather.js.

  CHECK THE COORDINATES BEFORE THE DEMO. Eunos Community Club is the one
  real value taken from OneMap. The rest are close to the right place but
  were not looked up, so confirm each one with searchAddress() from
  lib/onemap.js and paste the result in. A wrong pair puts the marker in
  the wrong part of Singapore, which is very visible on a map.
*/
export const hotspots = [
  {
    id: 'eunos-cc',
    name: 'Eunos Community Club',
    latitude: 1.332644,
    longitude: 103.915255,
    outdoor: false,
    weatherArea: 'Paya Lebar',
  },
  {
    id: 'eunos-crescent-market',
    name: 'Eunos Crescent Market and Food Centre',
    latitude: 1.32,
    longitude: 103.9035,
    outdoor: false,
    weatherArea: 'Geylang',
  },
  {
    id: 'eunos-mrt',
    name: 'Eunos MRT Station',
    latitude: 1.3197,
    longitude: 103.903,
    outdoor: false,
    weatherArea: 'Geylang',
  },
  {
    id: 'eunos-community-garden',
    name: 'Eunos Community Garden',
    latitude: 1.3215,
    longitude: 103.9065,
    outdoor: true,
    weatherArea: 'Geylang',
  },
  {
    id: 'eunos-park',
    name: 'Eunos Link Park',
    latitude: 1.3245,
    longitude: 103.9085,
    outdoor: true,
    weatherArea: 'Geylang',
  },
]

// 'eunos-cc' -> the hotspot object, or undefined if the id is unknown
export function findHotspot(id) {
  return hotspots.find((h) => h.id === id)
}

// 'eunos-cc' -> 'Eunos Community Club'. Falls back to the id so a hangout
// saved with an old hotspot id still shows something.
export function hotspotName(id) {
  return findHotspot(id)?.name ?? id
}
