/*
  GUIDE (Owner: Clarence Tay): hotspot hangouts, backed by Supabase.

  Modelled on stores/skillSwap.js. Every action returns { ok: true } or
  { ok: false, error: 'Plain sentence' }, so pages can show the message
  without knowing anything about the database.

  The rules live in supabase/schema.sql section 7 and are enforced there:
  the browser may only insert a hangout, and joining, leaving, cancelling
  and completing all go through functions called with supabase.rpc().
  The checks repeated here are only so the person gets a clear message
  before a request is sent.
*/
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { sessionStart, sessionEnd } from '../lib/skillSwapFormat.js'
import { supabase } from '../lib/supabase.js'
import { NEAR_KM, nearPoint as filterNearPoint } from '../lib/nearby.js'

// Must match the duration check in supabase/schema.sql (set in section 7,
// widened in section 12). Change one, change the other, or the insert is
// refused by the database.
export const HANGOUT_DURATIONS = [30, 60, 90, 120, 150, 180]

const COLUMNS = `id, title, description, hotspot_id, place_name, latitude, longitude, outdoor, hangout_date, hangout_time, duration, status, host_id, created_at, host:profiles!host_id(name), attendees:hangout_attendees(user_id)`

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    hotspotId: r.hotspot_id,
    // Every hangout carries its own place, so the card and the map never have
    // to look anything up. hotspotId is only a tag for the filter, and is null
    // for a place someone searched for on OneMap.
    placeName: r.place_name,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    outdoor: r.outdoor === true,
    date: r.hangout_date,
    time: String(r.hangout_time).slice(0, 5),
    duration: r.duration,
    status: r.status,
    hostId: r.host_id,
    hostName: r.host?.name ?? '',
    attendeeIds: (r.attendees ?? []).map((a) => a.user_id),
    createdAt: new Date(r.created_at).getTime(),
  }
}

export const useHangoutStore = defineStore('hangout', () => {
  const auth = useAuthStore()
  const hangouts = ref([])
  const loading = ref(false)
  const loadError = ref('')

  async function load() {
    loading.value = true
    loadError.value = ''
    const { data, error } = await supabase
      .from('hangouts')
      .select(COLUMNS)
      .order('hangout_date', { ascending: true })
    if (error) {
      // Shown in the browser console (F12) to help find the cause
      console.error('Could not load hangouts:', error.code, error.message, error.details ?? '', error.hint ?? '')
      loadError.value = 'Could not load hangouts. Please try again.'
    } else {
      hangouts.value = data.map(fromRow)
    }
    loading.value = false
  }

  // Run a Supabase call, then reload so every page sees the change
  async function run(call) {
    const { error } = await call
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }

  // ---- helpers ----

  const me = computed(() => auth.user || null)

  const find = (id) => hangouts.value.find((h) => h.id === id)
  const isHost = (hangout) => !!me.value && hangout.hostId === me.value.id
  const isGoing = (hangout) => !!me.value && hangout.attendeeIds.includes(me.value.id)
  const goingCount = (hangout) => hangout.attendeeIds.length

  // The time now, updated every minute so past items drop off without a reload.
  // Pinia stores live for the whole app, so the interval is never cleared.
  const now = ref(new Date())
  setInterval(() => { now.value = new Date() }, 60 * 1000)

  const hasStarted = (item) => sessionStart(item.date, item.time) <= now.value
  const hasEnded = (item) => sessionEnd(item.date, item.time, item.duration) <= now.value
  // Ended items stay for their host only, until they mark them done or cancel
  const stillShown = (item) => !hasEnded(item) || isHost(item)

  const needSignIn = () => ({ ok: false, error: 'Please sign in first.' })
  const notFound = () => ({ ok: false, error: 'We could not find that hangout.' })

  // ---- computeds ----

  const byStart = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)

  /** Open hangouts that have not ended (or that I host), soonest first. */
  const openHangouts = computed(() =>
    hangouts.value.filter((h) => h.status === 'open' && stillShown(h)).sort(byStart),
  )
  /** Open hangouts the signed-in person is hosting. */
  const myHangouts = computed(() => openHangouts.value.filter((h) => isHost(h)))
  /** Open hangouts the signed-in person is going to. */
  const myJoined = computed(() => openHangouts.value.filter((h) => isGoing(h)))

  /** Open hangouts at one place, or all of them when name is ''. */
  function atPlace(placeName) {
    if (!placeName) return openHangouts.value
    return openHangouts.value.filter((h) => h.placeName === placeName)
  }

  /*
    "Near" is worked out in lib/nearby.js, shared with the Help Board and
    Skill Swaps so all three pages mean the same thing by it. NEAR_KM is
    re-exported here because HangoutsView.vue reads it off the store.
  */

  /** Open hangouts within NEAR_KM of a tapped point, or all when none given. */
  function nearPoint(point) {
    return filterNearPoint(openHangouts.value, point)
  }

  // ---- actions (each returns { ok, error }) ----

  async function createHangout(data) {
    if (!me.value) return needSignIn()
    if (me.value.guardian_status === 'pending') {
      return { ok: false, error: 'Your parent or guardian needs to confirm your account before you can host.' }
    }

    const title = String(data.title || '').trim()
    const description = String(data.description || '').trim()
    const duration = Number(data.duration)
    const placeName = String(data.placeName || '').trim()
    const latitude = Number(data.latitude)
    const longitude = Number(data.longitude)

    if (title.length < 5) return { ok: false, error: 'The name needs at least 5 letters.' }
    if (description.length < 10) {
      return { ok: false, error: 'Please say a little more about the hangout (at least 10 letters).' }
    }
    if (placeName.length < 3) return { ok: false, error: 'Please choose a place to meet.' }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: 'We could not put that place on the map. Please search for it again.' }
    }
    // The same box the database checks, so the person gets a clear message
    // instead of a raw constraint error
    if (latitude < 1.1 || latitude > 1.6 || longitude < 103.5 || longitude > 104.2) {
      return { ok: false, error: 'That place is not in Singapore. Please choose somewhere closer to home.' }
    }
    if (!HANGOUT_DURATIONS.includes(duration)) return { ok: false, error: 'Please choose how long it will last.' }
    if (!data.date || !data.time) return { ok: false, error: 'Please choose a day and a time.' }
    if (sessionStart(data.date, data.time) < new Date()) {
      return { ok: false, error: 'That day and time have already passed.' }
    }

    // host_id is filled in by the database (default auth.uid()), and the
    // trigger there adds the host to the attendee list.
    return run(
      supabase.from('hangouts').insert({
        title,
        description,
        // null for a searched place; the id is only kept so the filter works
        hotspot_id: data.hotspotId || null,
        place_name: placeName,
        latitude,
        longitude,
        outdoor: data.outdoor === true,
        hangout_date: data.date,
        hangout_time: data.time,
        duration,
      }),
    )
  }

  async function joinHangout(id) {
    if (!me.value) return needSignIn()
    const h = find(id)
    if (!h) return notFound()
    if (h.status !== 'open') return { ok: false, error: 'This hangout is no longer open.' }
    if (isHost(h)) return { ok: false, error: 'You are hosting this hangout, so you are already going.' }
    if (isGoing(h)) return { ok: false, error: 'You are already going to this hangout.' }
    if (hasStarted(h)) return { ok: false, error: 'This has already started, so it is too late to join.' }
    if (me.value.guardian_status === 'pending') {
      return { ok: false, error: 'Your parent or guardian needs to confirm your account before you can join.' }
    }
    return run(supabase.rpc('join_hangout', { hangout_id: id }))
  }

  async function leaveHangout(id) {
    if (!me.value) return needSignIn()
    const h = find(id)
    if (!h) return notFound()
    if (isHost(h)) return { ok: false, error: 'You are hosting this hangout. Cancel it instead.' }
    if (!isGoing(h)) return { ok: false, error: 'You are not going to this hangout.' }
    return run(supabase.rpc('leave_hangout', { hangout_id: id }))
  }

  async function cancelHangout(id) {
    if (!me.value) return needSignIn()
    const h = find(id)
    if (!h) return notFound()
    if (!isHost(h)) return { ok: false, error: 'Only the host can cancel this hangout.' }
    return run(supabase.rpc('cancel_hangout', { hangout_id: id }))
  }

  // Everyone who went, the host included, is paid by the database function
  async function completeHangout(id) {
    if (!me.value) return needSignIn()
    const h = find(id)
    if (!h) return notFound()
    if (!isHost(h)) return { ok: false, error: 'Only the host can complete this hangout.' }
    if (sessionStart(h.date, h.time) > new Date()) {
      return { ok: false, error: 'You can mark a hangout as done once it has started.' }
    }
    // Other refusals (e.g. nobody else joined) come back from the database as plain sentences
    const result = await run(supabase.rpc('complete_hangout', { hangout_id: id }))
    if (!result.ok) return result
    // complete_hangout() adds points_ledger rows, so refresh the balance in the navbar
    await usePointsStore().load()
    return { ok: true }
  }

  return {
    hangouts,
    loading,
    loadError,
    load,
    openHangouts,
    myHangouts,
    myJoined,
    atPlace,
    nearPoint,
    NEAR_KM,
    isHost,
    isGoing,
    goingCount,
    hasStarted,
    hasEnded,
    createHangout,
    joinHangout,
    leaveHangout,
    cancelHangout,
    completeHangout,
  }
})
