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
import { findHotspot } from '../lib/hotspots.js'
import { sessionStart } from '../lib/skillSwapFormat.js'
import { supabase } from '../lib/supabase.js'

// Must match the duration check in supabase/schema.sql section 7. Change one,
// change the other, or the insert is refused by the database.
export const HANGOUT_DURATIONS = [30, 60, 90, 120]

const COLUMNS = `id, title, description, hotspot_id, hangout_date, hangout_time, duration, status, host_id, created_at, host:profiles!host_id(name), attendees:hangout_attendees(user_id)`

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    hotspotId: r.hotspot_id,
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

  const needSignIn = () => ({ ok: false, error: 'Please sign in first.' })
  const notFound = () => ({ ok: false, error: 'We could not find that hangout.' })

  // ---- computeds ----

  const byStart = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)

  /** Hangouts people can still join, soonest first. */
  const openHangouts = computed(() =>
    hangouts.value.filter((h) => h.status === 'open').sort(byStart),
  )
  /** Open hangouts the signed-in person is hosting. */
  const myHangouts = computed(() => openHangouts.value.filter((h) => isHost(h)))
  /** Open hangouts the signed-in person is going to. */
  const myJoined = computed(() => openHangouts.value.filter((h) => isGoing(h)))

  /** Open hangouts at one hotspot, or all of them when id is '' . */
  function atHotspot(hotspotId) {
    if (!hotspotId) return openHangouts.value
    return openHangouts.value.filter((h) => h.hotspotId === hotspotId)
  }

  // ---- actions (each returns { ok, error }) ----

  async function createHangout(data) {
    if (!me.value) return needSignIn()

    const title = String(data.title || '').trim()
    const description = String(data.description || '').trim()
    const duration = Number(data.duration)

    if (title.length < 5) return { ok: false, error: 'The name needs at least 5 letters.' }
    if (description.length < 10) {
      return { ok: false, error: 'Please say a little more about the hangout (at least 10 letters).' }
    }
    if (!findHotspot(data.hotspotId)) return { ok: false, error: 'Please choose a place to meet.' }
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
        hotspot_id: data.hotspotId,
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
    atHotspot,
    isHost,
    isGoing,
    goingCount,
    createHangout,
    joinHangout,
    leaveHangout,
    cancelHangout,
    completeHangout,
  }
})
