
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { MAX_ACTIVE_TASKS } from '../lib/points.js'


const COLUMNS = `id, title, description, category, difficulty, duration, points, is_physical, status,
  requester_id, helper_id, needed_at, location, latitude, longitude, at_home, created_at,
  requester:profiles!requester_id(name, block),
  helper:profiles!helper_id(name)`

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    difficulty: r.difficulty,
    duration: r.duration,
    points: r.points,
    isPhysical: r.is_physical,
    status: r.status,
    seniorId: r.requester_id,
    seniorName: r.requester?.name ?? '',
    block: r.requester?.block ?? '',
    helperId: r.helper_id,
    helperName: r.helper?.name ?? null,
    neededAt: new Date(r.needed_at).getTime(),
    location: r.location,
    // numeric columns come back as strings; null on older requests without a pin
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    atHome: r.at_home,
    createdAt: new Date(r.created_at).getTime(),
  }
}

// An open request whose time has already gone by (nobody took it in time)
export function isPastTime(request) {
  return request.status === 'open' && request.neededAt < Date.now()
}

// When the help is needed, in plain words: "Sat 25 Oct, 3:00 PM"
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatNeededAt(ms) {
  const d = new Date(ms)
  const hour = d.getHours() % 12 || 12
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const amPm = d.getHours() < 12 ? 'AM' : 'PM'
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${hour}:${minutes} ${amPm}`
}

export const useHelpRequestStore = defineStore('helpRequest', () => {
  const auth = useAuthStore()
  // The points balance lives in the points store (see stores/points.js)
  const points = usePointsStore()

  const requests = ref([])
  const loading = ref(false)
  const loadError = ref('')
  // The load that is running right now, or null when none is
  let loadPromise = null

  // MainLayout and the page both call load() when they open, so share one fetch instead of sending two
  function load() {
    if (!loadPromise) loadPromise = fetchRequests().finally(() => { loadPromise = null })
    return loadPromise
  }

  async function fetchRequests() {
    loading.value = true
    loadError.value = ''
    const [{ data, error }] = await Promise.all([
      supabase.from('help_requests').select(COLUMNS).order('created_at', { ascending: false }),
      // Refresh the balance too, so points earned from an accept / confirm show straight away
      points.load(),
    ])
    if (error) loadError.value = 'Could not load requests. Please try again.'
    else requests.value = data.map(fromRow)
    loading.value = false
  }


  const myRequests = computed(() => requests.value.filter((r) => r.seniorId === auth.user?.id))
  const openRequests = computed(() => requests.value.filter((r) => r.status === 'open' && r.seniorId !== auth.user?.id))
  const myTasks = computed(() => requests.value.filter((r) => r.helperId === auth.user?.id))
  const activeCount = computed(
    () => myTasks.value.filter((r) => r.status === 'accepted' || r.status === 'pending_confirmation').length,
  )
  const atLimit = computed(() => activeCount.value >= MAX_ACTIVE_TASKS)

  function getRequestById(id) {
    return requests.value.find((r) => r.id === id) ?? null
  }

  async function run(call) {
    const { error } = await call
    // Reload after a failure too: the request may have changed (for example someone
    // else took it), so the list should show that instead of the old card
    if (loadPromise) await loadPromise.catch(() => {})
    await load()
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  // The pin for the meeting place, checked like stores/hangout.js does, so the
  // person gets a clear message instead of a raw database error
  function checkPin(d) {
    const latitude = Number(d.latitude)
    const longitude = Number(d.longitude)
    if (d.latitude == null || d.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: 'We could not put that place on the map. Please search for it again.' }
    }
    // The same box the database checks (schema.sql, help_requests)
    if (latitude < 1.1 || latitude > 1.6 || longitude < 103.5 || longitude > 104.2) {
      return { ok: false, error: 'That place is not in Singapore. Please choose somewhere closer to home.' }
    }
    return { ok: true, latitude, longitude }
  }

  const toRow = (d, pin) => ({
    title: d.title, description: d.description, category: d.category,
    difficulty: d.difficulty, duration: d.duration, is_physical: d.isPhysical,
    needed_at: new Date(d.neededAt).toISOString(),
    location: d.location.trim(),
    latitude: pin.latitude, longitude: pin.longitude,
    at_home: !!d.atHome,
  })

  async function createRequest(d) {
    const pin = checkPin(d)
    if (!pin.ok) return pin
    return run(supabase.from('help_requests').insert(toRow(d, pin)))
  }

  async function updateRequest(id, d) {
    const pin = checkPin(d)
    if (!pin.ok) return pin
    return run(supabase.from('help_requests').update(toRow(d, pin)).eq('id', id))
  }

  const cancelRequest = (id) => run(supabase.rpc('cancel_help_request', { request_id: id }))
  const markDone = (id) => run(supabase.rpc('mark_task_done', { request_id: id }))
  const withdrawFromTask = (id) => run(supabase.rpc('withdraw_from_task', { request_id: id }))
  const acceptRequest = (id, physicalOk = false) =>
    run(supabase.rpc('accept_help_request', { request_id: id, physical_ok: physicalOk }))

 
  const confirmDone = (id) => run(supabase.rpc('confirm_help_done', { request_id: id }))

  // Only your own cancelled requests can be deleted (schema.sql). When that rule
  // stops it, Supabase deletes nothing but gives no error, so ask for the deleted
  // row back and check that there was one.
  async function deleteRequest(id) {
    let deleted = []
    const result = await run(supabase.from('help_requests').delete().eq('id', id).select('id')
      .then((response) => { deleted = response.data ?? []; return response }))
    if (result.ok && deleted.length === 0) return { ok: false, error: 'This request can no longer be deleted.' }
    return result
  }

  return {
    requests, loading, loadError,
    myRequests, openRequests, myTasks, activeCount, atLimit,
    getRequestById, load,
    createRequest, updateRequest, cancelRequest, confirmDone, deleteRequest,
    acceptRequest, markDone, withdrawFromTask,
  }
})
