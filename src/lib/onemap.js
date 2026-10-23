/*
  GUIDE (Owner: Clarence Tay): every OneMap call lives here.

  Nothing else in the app talks to OneMap, so there is one place to change
  the address, the token or the error handling, and Playwright can replace
  this module in tests instead of calling a live government API.

  TOKEN
  Search works without a token today: OneMap returns the results and adds an
  "error" field nagging you to register. We still send the token when .env has
  one (VITE_ONEMAP_TOKEN), because OneMap may start enforcing it. A token only
  lasts about 3 days, so the app must keep working without one - never treat a
  missing token as a failure.

  Docs: https://www.onemap.gov.sg/apidocs
*/
import axios from 'axios'

const BASE = 'https://www.onemap.gov.sg'
const token = import.meta.env.VITE_ONEMAP_TOKEN

// Only added when .env has a token
function headers() {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// One result from OneMap, turned into the shape the app uses.
// LATITUDE and LONGITUDE come back as strings, so Number() them.
function fromResult(r) {
  return {
    name: r.SEARCHVAL,
    address: r.ADDRESS,
    postal: r.POSTAL === 'NIL' ? '' : r.POSTAL,
    lat: Number(r.LATITUDE),
    lng: Number(r.LONGITUDE),
  }
}

/*
  'eunos community club' -> a list of places, nearest match first.
  Returns [] when nothing matched or the request failed: the map and the
  search box must never break the page, the same rule as the weather call.
*/
export async function searchAddress(searchVal) {
  const query = String(searchVal || '').trim()
  if (!query) return []

  try {
    const response = await axios.get(`${BASE}/api/common/elastic/search`, {
      params: { searchVal: query, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 },
      headers: headers(),
    })

    // Do NOT check response.data.error here. Without a token OneMap fills it
    // in but still sends the results, so reading it as a failure would throw
    // away perfectly good coordinates.
    const results = response.data?.results ?? []
    return results.map(fromResult).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  } catch (e) {
    // Shown in the browser console (F12) to help find the cause
    console.error('OneMap search failed:', e.message)
    return []
  }
}
