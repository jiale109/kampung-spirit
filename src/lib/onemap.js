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
  HOW SINGAPOREANS WRITE ADDRESSES vs HOW ONEMAP STORES THEM
  ----------------------------------------------------------
  People type "Blk 412 Eunos Cres". OneMap indexes that same flat as
  "412 EUNOS CRESCENT SINGAPORE 409412": no "Blk", and the road name spelt
  out in full. So the words someone naturally writes do not match anything,
  and the search comes back empty.

  expandAddress() rewrites the few abbreviations that matter here before the
  query is sent. It is deliberately small: every entry is a Singapore street
  type or a word on HDB signage, and anything not on the list is left alone.
*/

// Dropped: OneMap keeps the block number on its own, with no "Blk" in front
const DROPPED_WORDS = new Set(['blk', 'block'])

const ABBREVIATIONS = {
  ave: 'avenue',
  av: 'avenue',
  bt: 'bukit',
  cl: 'close',
  cres: 'crescent',
  ctrl: 'central',
  dr: 'drive',
  gdns: 'gardens',
  hts: 'heights',
  ind: 'industrial',
  jln: 'jalan',
  lor: 'lorong',
  mkt: 'market',
  nth: 'north',
  pk: 'park',
  pl: 'place',
  rd: 'road',
  sth: 'south',
  sq: 'square',
  st: 'street',
  ter: 'terrace',
  upp: 'upper',
  cc: 'community club',
}

/*
  'Blk 412 Eunos Cres'  -> '412 eunos crescent'
  'Bishan St 13'        -> 'bishan street 13'
  'St Andrew\'s Road'   -> "st andrew's road"   (st first = Saint, left alone)

  Returns '' if every word was dropped, so the caller can fall back.
*/
export function expandAddress(text) {
  const words = String(text || '').toLowerCase().trim().split(/\s+/).filter(Boolean)

  const out = []
  words.forEach((word, index) => {
    // Keep any punctuation attached to the word out of the lookup
    const bare = word.replace(/[.,]/g, '')
    if (DROPPED_WORDS.has(bare)) return

    /*
      "St" at the START of a name is Saint, not Street: "St Andrew's Road",
      "St Michael's Road". Anywhere else it is a street - "Bishan St 13".
      Guessing wrong here breaks a search that works today, so only the
      non-leading one is expanded.
    */
    if (bare === 'st' && index === 0) {
      out.push(bare)
      return
    }

    out.push(ABBREVIATIONS[bare] ?? bare)
  })

  return out.join(' ')
}

/*
  'eunos community club' -> a list of places, nearest match first.
  Returns [] when nothing matched or the request failed: the map and the
  search box must never break the page, the same rule as the weather call.
*/
async function askOneMap(query) {
  const response = await axios.get(`${BASE}/api/common/elastic/search`, {
    params: { searchVal: query, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 },
    headers: headers(),
  })

  // Do NOT check response.data.error here. Without a token OneMap fills it
  // in but still sends the results, so reading it as a failure would throw
  // away perfectly good coordinates.
  const results = response.data?.results ?? []
  return results.map(fromResult).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
}

export async function searchAddress(searchVal) {
  const query = String(searchVal || '').trim()
  if (!query) return []

  const expanded = expandAddress(query)

  try {
    /*
      Ask with the expanded wording first, because that is the spelling
      OneMap indexes. If it finds nothing AND the wording actually changed,
      ask again exactly as the person typed it, so this can only ever find
      more than before, never less.
    */
    const first = expanded ? await askOneMap(expanded) : []
    if (first.length > 0) return first
    if (!expanded || expanded === query.toLowerCase()) return first
    return await askOneMap(query)
  } catch (e) {
    // Shown in the browser console (F12) to help find the cause
    console.error('OneMap search failed:', e.message)
    return []
  }
}
