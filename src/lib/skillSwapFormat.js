const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',]

export const MIN_CAPACITY = 1
export const MAX_CAPACITY = 10

const pad = (n) => String(n).padStart(2,'0')

export function toISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` 
}

export function todayISO() {
  return toISO(new Date())
}

export function dateFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toISO(d)
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso) {
  const d = parseISO(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

//format date to display as dd-mm-yyyy
export function formatDateShort(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

//to change to 12-hour clock from 24-hour clock
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${suffix}`
}

//convert minutes to hour and minutes
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minutes`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hours = h === 1 ? '1 hour' : `${h} hours`
  return m ? `${hours} ${m} minutes` : hours
}

//to check if date has already passed 
export function sessionStart(dateISO, hhmm) {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

/*
  When it finishes: the start plus however long it lasts.

  stores/hangout.js and stores/skillSwap.js both use this for hasEnded(), so
  a hangout or a session stays on the page while it is still going on and
  drops off once it is over.
*/
export function sessionEnd(dateISO, hhmm, durationMinutes) {
  const start = sessionStart(dateISO, hhmm)
  return new Date(start.getTime() + Number(durationMinutes) * 60 * 1000)
}

//session categories 
/*
  The suggestions offered when hosting a session. People may also type their
  own, so this is a starting list rather than the only allowed answers.

  These used to disagree with the database, which accepted 'Health & fitness',
  'Arts & music' and 'Other'. Three of the seven tiles were therefore refused
  on save. They are spelt here exactly as schema.sql section 8 spelt them, so
  old rows keep matching a tile.
*/
export const CATEGORIES = [
  'Tech',
  'Cooking',
  'Crafts',
  'Health & fitness',
  'Arts & music',
  'Languages',
  'Other',
]

/*
  The longest kind of session someone may type. Long enough for
  'Traditional kueh making', short enough to still fit on a tile and in the
  filter list. The database checks the same length
  (migrations/20261029140000_open_up_session_categories.sql).
*/
export const MAX_CATEGORY_LENGTH = 40

/*
  Tidy up a kind of session someone typed in, so a hand-typed one still
  matches a host who picked the same thing from the suggestions above.

    'cooking'   -> 'Cooking'      (on the list, so it snaps to it)
    'COOKING'   -> 'Cooking'
    'mahjong  club ' -> 'Mahjong club'   (new, so only the spaces are tidied)

  This is the same idea as tidyInterest() in lib/profile.js, and it is what
  recovers most of what the fixed list used to guarantee: two people teaching
  the same thing still file it under the same word.

  Returns '' for anything blank, which the caller treats as nothing typed.
*/
export function tidyCategory(text) {
  const words = String(text || '').trim().split(' ').filter((word) => word !== '')
  const clean = words.join(' ')
  if (clean === '') return ''

  const known = CATEGORIES.find((name) => name.toLowerCase() === clean.toLowerCase())
  if (known) return known

  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

//for weekends-only filter 
export function isWeekend(iso) {
  const day = parseISO(iso).getDay()
  return day === 0 || day === 6
}

//skill swap session display formatting 

//sort-by options 
export const SORT_OPTIONS = [
  { key: 'date-asc', label: 'Nearest date first' },
  { key: 'date-desc', label: 'Furthest date first' },
  { key: 'dur-asc', label: 'Shortest first' },
  { key: 'dur-desc', label: 'Longest first' },
  { key: 'spots-desc', label: 'Most spots left' },
  { key: 'spots-asc', label: 'Fewest spots left' },
]


//filtering days shown based on user's availability 
export const WHEN_FILTERS = [
  { key: 'any', label: 'Any day' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'weekend', label: 'Weekends only' },
]

//skill swap form fomatting 

//duration options  
export const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180].map((value) => ({
  value,
  label: formatDuration(value),
}))

//time options 
export const TIME_OPTIONS = (() => {
  const out = []
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) continue
      const value = `${pad(h)}:${pad(m)}`
      out.push({ value, label: formatTime(value) })
    }
  }
  return out
})()

//date options
export function dateOptions(days = 60) {
  return Array.from({ length: days }, (_, i) => {
    const value = dateFromToday(i)
    return { value, label: formatDate(value) }
  })
}

//capacity options
export const CAPACITY_OPTIONS = Array.from(
  { length: MAX_CAPACITY - MIN_CAPACITY + 1 },
  (_, i) => {
    const value = MIN_CAPACITY + i
    return { value, label: value === 1 ? '1 person' : `${value} people` }
  },
)

export function categoryClass(name) {
  const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug ? `cat-${slug}` : ''
}

