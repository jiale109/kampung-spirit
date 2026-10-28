/*
  Finding things near a point on the map                 Owner: Clarence Tay

  Hangouts, the Help Board and Skill Swaps all let you press a place on the
  map and see only what is near it. The sums live here so that all three agree
  on what "near" means, rather than each store carrying its own copy that can
  quietly drift.

  Anything passed in needs a numeric `latitude` and `longitude`, which is how
  the hangouts, help_requests and skill_sessions rows all store them.
*/

/*
  How far from a chosen point still counts as "here". One kilometre is about
  a twelve minute walk, which is the sort of distance a resident means when
  they press a spot on the map.

  Change this one number to make every page's filter wider or tighter.
*/
export const NEAR_KM = 1

/*
  Singapore is tiny, so treating a degree as a flat 111 km in both directions
  is accurate to a few metres here. No great-circle maths needed.
*/
export function distanceKm(aLat, aLng, bLat, bLng) {
  const dLat = (aLat - bLat) * 111
  const dLng = (aLng - bLng) * 111
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/*
  Is this one near the point?

  No point given means no filter is on, so everything counts as near.

  An item with NO pin of its own counts as NOT near. Older help requests were
  saved before the map was added and have no coordinates, and we cannot
  honestly claim they are close to anywhere. The pages say how many were left
  out for this reason, so it does not look like they went missing.
*/
export function isNearPoint(item, point, km = NEAR_KM) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return true
  if (!Number.isFinite(item?.latitude) || !Number.isFinite(item?.longitude)) return false
  return distanceKm(item.latitude, item.longitude, point.lat, point.lng) <= km
}

/** The ones within km of the point, or all of them when no point is given. */
export function nearPoint(items, point, km = NEAR_KM) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return items
  return items.filter((item) => isNearPoint(item, point, km))
}

/*
  How many were left out only because they have no pin. The pages show this so
  that a request saved before the map existed does not look like it vanished.
*/
export function countWithoutPin(items) {
  return items.filter(
    (item) => !Number.isFinite(item?.latitude) || !Number.isFinite(item?.longitude),
  ).length
}

/*
  One marker per place that has something on it, with a count. Two sessions at
  the same place produce one marker saying "2".

  nameKey is the field holding the place name: 'placeName' for hangouts,
  'location' for help requests, 'venue' for skill swaps.
*/
export function placeMarkers(items, nameKey) {
  const byName = new Map()
  for (const item of items) {
    if (!Number.isFinite(item?.latitude) || !Number.isFinite(item?.longitude)) continue
    const name = item[nameKey]
    const found = byName.get(name)
    if (found) {
      found.count += 1
      continue
    }
    byName.set(name, {
      name,
      latitude: item.latitude,
      longitude: item.longitude,
      count: 1,
    })
  }
  return [...byName.values()]
}
