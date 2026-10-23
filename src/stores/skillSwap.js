import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { pointsForSkillSwap } from '../lib/points.js'
import { sessionStart, sessionEnd, CATEGORIES, MIN_CAPACITY, MAX_CAPACITY } from '../lib/skillSwapFormat.js'
//import { seedSessions } from '../lib/seed'
import { supabase } from '../lib/supabase.js'

const COLUMNS = `id, title, description, category, venue, session_date, session_time, duration, capacity, status, host_id, created_at, host:profiles!host_id(name), attendees:skill_session_attendees(user_id)`

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    venue: r.venue,
    date: r.session_date,
    time: String(r.session_time).slice(0,5),
    duration: r.duration,
    capacity: r.capacity,
    status: r.status,
    hostId: r.host_id,
    hostName: r.host?.name ?? '',
    attendeeIds: (r.attendees ?? []).map((a) => a.user_id),
    createdAt: new Date(r.created_at).getTime(),
  }
}

export const useSkillSwapStore = defineStore('skillSwap', () => {
    const auth = useAuthStore()
    const sessions = ref([])
    const loading = ref('')
    const loadError = ref(false)
 
    async function load() {
    loading.value = true
    loadError.value = ''
    const { data, error } = await supabase
      .from('skill_sessions').select(COLUMNS).order('session_date', { ascending: true })
    if (error) loadError.value = 'Could not load sessions. Please try again.'
    else sessions.value = data.map(fromRow)
    loading.value = false
  }

    async function run(call) {
    const { error } = await call
    if (error) return { ok: false, error: error.message, code: error.code }
    await load()
    return { ok: true }
  }
 
  // ---- helpers ----
 
  const me = computed(() => auth.user || null)
 
  const find = (id) => sessions.value.find((s) => s.id === id)
  const spotsLeft = (session) => Math.max(0, session.capacity - session.attendeeIds.length)
  const isHost = (session) => !!me.value && session.hostId === me.value.id
  const isAttending = (session) => !!me.value && session.attendeeIds.includes(me.value.id)

  // The time now, updated every minute so past items drop off without a reload.
  // Pinia stores live for the whole app, so the interval is never cleared.
  const now = ref(new Date())
  setInterval(() => { now.value = new Date() }, 60 * 1000)

  const hasStarted = (item) => sessionStart(item.date, item.time) <= now.value
  const hasEnded = (item) => sessionEnd(item.date, item.time, item.duration) <= now.value
  // Ended items stay for their host only, until they mark them done or cancel
  const stillShown = (item) => !hasEnded(item) || isHost(item)
 
  const needSignIn = () => ({ ok: false, error: 'Please sign in first.' })
  const notFound = () => ({ ok: false, error: 'We could not find that session.' })
 
  // ---- computeds ----
 
  const byStart = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
 
  /** Open sessions that have not ended (or that I host), soonest first. */
  const openSessions = computed(() =>
    sessions.value.filter((s) => s.status === 'open' && stillShown(s)).sort(byStart),
  )
  /** Open sessions the signed-in person is hosting. */
  const mySessions = computed(() => openSessions.value.filter((s) => isHost(s)))
  /** Open sessions the signed-in person has a place in. */
  const myRsvps = computed(() => openSessions.value.filter((s) => isAttending(s)))
 
  // ---- actions (each returns { ok, error }) ----
 
  async function createSession(data) {
    if (!me.value) return needSignIn()
 
    const title = String(data.title || '').trim()
    const description = String(data.description || '').trim()
    const venue = String(data.venue || '').trim()
    const capacity = Number(data.capacity)
    const duration = Number(data.duration)
 
    if (title.length < 5) return { ok: false, error: 'The name needs at least 5 letters.' }
    if (!description) return { ok: false, error: 'Please say what people will learn.' }
    if (!CATEGORIES.includes(data.category)) {
      return { ok: false, error: 'Please choose a type of session.' }
    }
    if (venue.length < 3) return { ok: false, error: 'Please say where the session will be.' }
    if (!Number.isInteger(capacity) || capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
      return { ok: false, error: `Choose between ${MIN_CAPACITY} and ${MAX_CAPACITY} people.` }
    }
    if (!data.date || !data.time) return { ok: false, error: 'Please choose a day and a time.' }
    if (sessionStart(data.date, data.time) < new Date()) {
      return { ok: false, error: 'That day and time have already passed.' }
    }
 
    const result = await run(
      supabase.from('skill_sessions').insert({
        title,
        description,
        category: data.category,
        venue,
        session_date: data.date,
        session_time: data.time,
        duration,
        capacity,
      }),
    )
    // A check-constraint error means the category is not one the database accepts
    if (result.code === '23514') return { ok: false, error: 'Please choose a type of session from the list.' }
    return result
  }
 
  async function rsvp(id) {
    if (!me.value) return needSignIn()
    const s = find(id)
    if (!s) return notFound()
    if (s.status !== 'open') return { ok: false, error: 'This session is no longer open.' }
    if (isHost(s)) return { ok: false, error: 'You are hosting this session, so you already have a place.' }
    if (isAttending(s)) return { ok: false, error: 'You already have a place in this session.' }
    if (spotsLeft(s) <= 0) return { ok: false, error: 'Sorry, this session is full.' }
    if (hasStarted(s)) return { ok: false, error: 'This has already started, so it is too late to join.' }
    return run(supabase.rpc('join_skill_session', { swap_id: id }))
  }
 
  async function cancelRsvp(id) {
    if (!me.value) return needSignIn()
    const s = find(id)
    if (!s) return notFound()
    if (!isAttending(s)) return { ok: false, error: 'You do not have a place in this session.' }
    return run(supabase.rpc('leave_skill_session', { swap_id: id }))
  }
 
  async function cancelSession(id) {
    if (!me.value) return needSignIn()
    const s = find(id)
    if (!s) return notFound()
    if (!isHost(s)) return { ok: false, error: 'Only the host can cancel this session.' }
    return run(supabase.rpc('cancel_skill_session', { swap_id: id }))
  }
 
  // for display msg
  async function completeSession(id) {
    if (!me.value) return needSignIn()
    const s = find(id)
    if (!s) return notFound()
    if (!isHost(s)) return { ok: false, error: 'Only the host can complete this session.' }
    if (sessionStart(s.date, s.time) > new Date()) {
      return { ok: false, error: 'You can mark a session as completed once it has started.' }
    }
    // Other refusals (e.g. nobody joined) come back from the database as plain sentences
    const points = pointsForSkillSwap(s.duration)
    const result = await run(supabase.rpc('complete_skill_session', { swap_id: id }))
    if (!result.ok) return result
    // complete_skill_session() adds points_ledger rows, so refresh the balance in the navbar
    await usePointsStore().load()
    return { ok: true, points }
  }
 
  return {
    sessions,
    loading,
    loadError,
    load,
    openSessions,
    mySessions,
    myRsvps,
    spotsLeft,
    isHost,
    isAttending,
    hasStarted,
    hasEnded,
    createSession,
    rsvp,
    cancelRsvp,
    cancelSession,
    completeSession,
  }
})
