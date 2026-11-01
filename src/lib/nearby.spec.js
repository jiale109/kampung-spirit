/*
  Unit tests for lib/nearby.js                           Owner: Clarence Tay

  Unit tests, not E2E ones: no browser, no database, no Supabase. Week 10 puts
  it as "Vitest asks: does this piece of code work correctly?" while Playwright
  asks "can the user complete a task?". The e2e specs in e2e/ answer the second
  question; this file answers the first.

  Run them with:
      pnpm test:unit            (once)
      pnpm vitest               (watch mode: reruns when a file is saved)

  These four functions decide what counts as "near here" on the Hangouts, Help
  Board and Skill Swaps maps, so getting them wrong shows a resident the wrong
  side of the estate.
*/
import { describe, it, expect } from 'vitest'
import { NEAR_KM, distanceKm, isNearPoint, nearPoint, countWithoutPin, placeMarkers } from './nearby.js'

// Real places, so a wrong answer is obvious to a person reading the test
const EUNOS_CC = { latitude: 1.332644, longitude: 103.915255, placeName: 'Eunos CC' }
const EUNOS_PARK = { latitude: 1.3245, longitude: 103.9085, placeName: 'Eunos Link Park' }
const BISHAN_CC = { latitude: 1.3509, longitude: 103.8485, placeName: 'Bishan CC' }
const NO_PIN = { latitude: null, longitude: null, placeName: 'An older request' }

const at = (item) => ({ lat: item.latitude, lng: item.longitude })

describe('distanceKm', () => {
  it('is zero from a place to itself', () => {
    expect(distanceKm(1.3326, 103.9152, 1.3326, 103.9152)).toBe(0)
  })

  it('measures Eunos CC to Bishan CC as about 7.7 km', () => {
    const km = distanceKm(1.332644, 103.915255, 1.3509, 103.8485)
    expect(km).toBeGreaterThan(7.5)
    expect(km).toBeLessThan(8)
  })

  it('gives the same answer whichever way round the two places are', () => {
    const there = distanceKm(1.332644, 103.915255, 1.3509, 103.8485)
    const back = distanceKm(1.3509, 103.8485, 1.332644, 103.915255)
    expect(there).toBe(back)
  })

  it('counts a difference in longitude, not only in latitude', () => {
    // Same latitude, so a naive version that only looked at latitude would
    // wrongly say these two are in the same spot
    expect(distanceKm(1.33, 103.90, 1.33, 103.95)).toBeGreaterThan(5)
  })
})

describe('isNearPoint', () => {
  it('says yes to a place at the point itself', () => {
    expect(isNearPoint(EUNOS_CC, at(EUNOS_CC))).toBe(true)
  })

  it('says no to a place on the other side of the island', () => {
    expect(isNearPoint(BISHAN_CC, at(EUNOS_CC))).toBe(false)
  })

  it('says yes to everything when no point is chosen, because no filter is on', () => {
    expect(isNearPoint(BISHAN_CC, null)).toBe(true)
  })

  it('says no to a row with no pin, rather than pretending it is close', () => {
    // Requests saved before the map existed have no coordinates. Counting
    // them as "near" would send a neighbour somewhere we cannot point to.
    expect(isNearPoint(NO_PIN, at(EUNOS_CC))).toBe(false)
  })

  it('ignores a point whose numbers came through as text', () => {
    // OneMap returns LATITUDE as a string. If a caller forgets to convert it,
    // the honest answer is "no filter" rather than a silently empty page.
    expect(isNearPoint(BISHAN_CC, { lat: '1.33', lng: '103.91' })).toBe(true)
  })
})

describe('nearPoint', () => {
  const all = [EUNOS_CC, EUNOS_PARK, BISHAN_CC, NO_PIN]

  it('keeps only what is near the chosen point', () => {
    expect(nearPoint(all, at(BISHAN_CC))).toEqual([BISHAN_CC])
  })

  it('returns everything untouched when nothing is chosen', () => {
    expect(nearPoint(all, null)).toHaveLength(4)
  })

  it('finds nothing when the point is far from every one of them', () => {
    // Tuas, the far west; nothing in this estate is within a kilometre
    expect(nearPoint(all, { lat: 1.32, lng: 103.65 })).toHaveLength(0)
  })

  it('can be opened up by asking for a wider distance', () => {
    // Eunos CC to Eunos Link Park is 1.17 km, so it is outside the usual
    // 1 km but inside 2 km. This is the behaviour to change if the estate
    // ever feels too tightly filtered.
    expect(nearPoint(all, at(EUNOS_CC))).toHaveLength(1)
    expect(nearPoint(all, at(EUNOS_CC), 2)).toHaveLength(2)
  })

  it('uses NEAR_KM when no distance is given', () => {
    expect(nearPoint(all, at(EUNOS_CC))).toEqual(nearPoint(all, at(EUNOS_CC), NEAR_KM))
  })
})

describe('countWithoutPin', () => {
  it('counts the ones the map cannot show', () => {
    expect(countWithoutPin([EUNOS_CC, NO_PIN, BISHAN_CC])).toBe(1)
  })

  it('counts nothing when every one has a pin', () => {
    expect(countWithoutPin([EUNOS_CC, BISHAN_CC])).toBe(0)
  })

  it('counts nothing in an empty list', () => {
    expect(countWithoutPin([])).toBe(0)
  })
})

describe('placeMarkers', () => {
  it('makes one marker per place, with a count', () => {
    const markers = placeMarkers([EUNOS_CC, EUNOS_CC, BISHAN_CC], 'placeName')
    expect(markers).toHaveLength(2)
    expect(markers[0]).toEqual({
      name: 'Eunos CC', latitude: 1.332644, longitude: 103.915255, count: 2,
    })
  })

  it('leaves out anything with no pin, since it cannot be drawn', () => {
    expect(placeMarkers([EUNOS_CC, NO_PIN], 'placeName')).toHaveLength(1)
  })

  it('reads the name from whichever field it is told to', () => {
    // hangouts call it placeName, help requests location, sessions venue
    const session = { latitude: 1.33, longitude: 103.91, venue: 'Eunos CC kitchen' }
    expect(placeMarkers([session], 'venue')[0].name).toBe('Eunos CC kitchen')
  })
})
