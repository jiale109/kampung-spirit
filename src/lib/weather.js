/*
  GUIDE (Owner: Clarence Tay): the data.gov.sg 2-hour weather forecast.

  Used to warn residents when rain is expected at an OUTDOOR hotspot
  (lib/hotspots.js sets outdoor and weatherArea).

  The fetch lives here, not in a page, so Playwright can replace this module
  and the tests never depend on a live government API.

  IF ANYTHING GOES WRONG, RETURN NOTHING. A missing forecast must show the
  hangout with no warning. Weather must never stop someone seeing or joining
  a hangout.

  The forecast only covers the NEXT TWO HOURS, so the wording says so. A
  hangout three days away is not covered by it, and we must not pretend it is.

  API: https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
*/
import axios from 'axios'

const URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast'

// Words in the forecast text that mean "take an umbrella"
const WET_WORDS = ['Rain', 'Showers', 'Thunder']

// How far ahead the data.gov.sg forecast looks
export const FORECAST_HOURS = 2

/*
  Reads the forecast once and returns { 'Geylang': 'Partly Cloudy (Day)', ... }.
  Returns {} when the request fails, which switches every warning off.
*/
export async function loadForecasts() {
  try {
    const response = await axios.get(URL)
    // v2 wraps the payload in data; fall back in case that ever changes
    const items = response.data?.data?.items ?? response.data?.items ?? []
    const forecasts = items[0]?.forecasts ?? []

    const byArea = {}
    for (const f of forecasts) {
      byArea[f.area] = f.forecast
    }
    return byArea
  } catch (e) {
    // Shown in the browser console (F12). The page carries on without warnings.
    console.error('Weather forecast failed:', e.message)
    return {}
  }
}

// 'Thundery Showers' -> true, 'Partly Cloudy (Day)' -> false
export function isWet(forecast) {
  const text = String(forecast || '')
  return WET_WORDS.some((word) => text.includes(word))
}

/*
  The sentence to show on a hangout card, or '' for no warning.
  forecasts comes from loadForecasts(); hotspot from lib/hotspots.js;
  startsAt is when the hangout starts, as a Date.
  Indoor hotspots never get a warning.

  Only hangouts inside the forecast window get a warning: starting at most
  FORECAST_HOURS from now, or started at most FORECAST_HOURS ago (so one that
  is probably still going on keeps its warning). Anything further away is not
  covered by a 2-hour forecast, so it gets no warning.
*/
export function weatherWarning(hotspot, forecasts, startsAt) {
  if (!hotspot || !hotspot.outdoor) return ''
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return ''
  const windowMs = FORECAST_HOURS * 60 * 60 * 1000
  const now = Date.now()
  if (startsAt.getTime() > now + windowMs || startsAt.getTime() < now - windowMs) return ''
  const forecast = forecasts?.[hotspot.weatherArea]
  if (!forecast || !isWet(forecast)) return ''
  // Worded this way so it reads correctly whether the forecast is singular
  // ('Light Rain') or plural ('Thundery Showers').
  return `This hangout is outdoors. The forecast near ${hotspot.weatherArea} for the next ${FORECAST_HOURS} hours is ${forecast.toLowerCase()}. Bring an umbrella.`
}
