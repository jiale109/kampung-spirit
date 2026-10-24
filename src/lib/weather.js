/*
  GUIDE (Owner: Clarence Tay): the data.gov.sg 2-hour weather forecast.

  Used to warn residents when rain is expected at an OUTDOOR hangout.

  Hangouts can now be at any place in Singapore, not only the hotspots in
  lib/hotspots.js, so a hangout cannot carry a fixed forecast area. Instead
  data.gov.sg also sends the coordinates of all 47 areas (area_metadata),
  and we pick whichever is nearest to the hangout. Each hangout stores its
  own outdoor flag, latitude and longitude (schema.sql section 11).

  The fetch lives here, not in a page, so Playwright can replace this module
  and the tests never depend on a live government API.

  IF ANYTHING GOES WRONG, RETURN NOTHING. A missing forecast must show the
  hangout with no warning. Weather must never stop someone seeing or joining
  a hangout.

  API: https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
*/
import axios from 'axios'

const URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast'

// Words in the forecast text that mean "take an umbrella"
const WET_WORDS = ['Rain', 'Showers', 'Thunder']

// How far ahead the data.gov.sg forecast looks
export const FORECAST_HOURS = 2

// What loadForecast() gives back when it cannot read anything
const NOTHING = { areas: [], byArea: {} }

/*
  Reads the forecast once. Returns
    { areas: [{ name, lat, lng }, ...], byArea: { 'Geylang': 'Cloudy', ... } }
  or empty lists when the request fails, which switches every warning off.
*/
export async function loadForecast() {
  try {
    const response = await axios.get(URL)
    // v2 wraps the payload in data; fall back in case that ever changes
    const data = response.data?.data ?? response.data ?? {}

    const areas = (data.area_metadata ?? [])
      .map((a) => ({
        name: a.name,
        lat: Number(a.label_location?.latitude),
        lng: Number(a.label_location?.longitude),
      }))
      .filter((a) => a.name && Number.isFinite(a.lat) && Number.isFinite(a.lng))

    const byArea = {}
    for (const f of data.items?.[0]?.forecasts ?? []) {
      byArea[f.area] = f.forecast
    }

    return { areas, byArea }
  } catch (e) {
    // Shown in the browser console (F12). The page carries on without warnings.
    console.error('Weather forecast failed:', e.message)
    return NOTHING
  }
}

/*
  The forecast area closest to a point, or '' when we have no areas.

  Singapore is small, so comparing plain squared differences in degrees is
  close enough to pick the nearest of 47 areas. No great-circle maths is
  needed, and no square root either: the smallest squared distance is also
  the smallest distance.
*/
export function nearestArea(latitude, longitude, areas) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''

  let best = ''
  let bestDistance = Infinity
  for (const area of areas ?? []) {
    const dLat = area.lat - latitude
    const dLng = area.lng - longitude
    const distance = dLat * dLat + dLng * dLng
    if (distance < bestDistance) {
      bestDistance = distance
      best = area.name
    }
  }
  return best
}

// 'Thundery Showers' -> true, 'Partly Cloudy (Day)' -> false
export function isWet(forecast) {
  const text = String(forecast || '')
  return WET_WORDS.some((word) => text.includes(word))
}

/*
  The sentence to show on a hangout card, or '' for no warning.

  hangout needs outdoor, latitude and longitude (all stored on the row).
  forecast comes from loadForecast(). startsAt is when the hangout starts,
  as a Date. Indoor hangouts never get a warning.

  Only hangouts inside the forecast window get a warning: starting at most
  FORECAST_HOURS from now, or started at most FORECAST_HOURS ago (so one that
  is probably still going on keeps its warning). Anything further away is not
  covered by a 2-hour forecast, so it gets no warning.
*/
export function weatherWarning(hangout, forecast, startsAt) {
  if (!hangout || !hangout.outdoor) return ''
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return ''

  const windowMs = FORECAST_HOURS * 60 * 60 * 1000
  const now = Date.now()
  if (startsAt.getTime() > now + windowMs || startsAt.getTime() < now - windowMs) return ''

  const area = nearestArea(hangout.latitude, hangout.longitude, forecast?.areas)
  if (!area) return ''

  const text = forecast?.byArea?.[area]
  if (!text || !isWet(text)) return ''

  // Worded this way so it reads correctly whether the forecast is singular
  // ('Light Rain') or plural ('Thundery Showers').
  return `This hangout is outdoors. The forecast near ${area} for the next ${FORECAST_HOURS} hours is ${text.toLowerCase()}. Bring an umbrella.`
}
