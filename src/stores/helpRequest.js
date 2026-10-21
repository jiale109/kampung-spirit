/*
  ============================================================================
  GUIDE: Help Board store                                 Owner: Victoria Soh
  ============================================================================
  STATUS: working, backed by Supabase (table help_requests in supabase/schema.sql).

  How it talks to the database
    load()                    select from help_requests. RLS returns open requests
                              plus the ones you asked for or are helping with.
    createRequest(data)       insert       (only title, description, category,
    updateRequest(id, d)      update        difficulty, duration may be written)
    cancelRequest(id)         rpc cancel_help_request   (requester, open or accepted)
    acceptRequest(id, ok)     rpc accept_help_request   (not your own, max 2 active,
                                                         under 18s need a verified guardian,
                                                         seniors confirm physical tasks)
    withdrawFromTask(id)      rpc withdraw_from_task    (helper, back to open)
    markDone(id)              rpc mark_task_done        (helper)
    confirmDone(id)           rpc confirm_help_done     (requester, adds the points)

  Every action returns { ok: true } or { ok: false, error }. error is the plain
  sentence from `raise exception` in the database function. After a successful
  action the list is loaded again, so the pages always show the database state.

  The database is the source of truth for the rules: it re-checks the status
  order, the 2-task limit and who may do what, and it calculates `points` and
  `is_physical` itself (trigger help_requests_fill_in). Checks in the pages are
  only there to give a friendlier message first.

  Status flow: open > accepted > pending_confirmation > completed (or cancelled).
  Anyone can ask and anyone can help; "senior" and "youth" pages are just the
  two sides of the same board (seniorId = the requester, helperId = the helper).

  Points: confirm_help_done writes to points_ledger in the database. Do NOT
  also call pointsStore.awardPoints(), or the points are counted twice.

  Related files: components/RequestCard.vue (the card), components/RequestForm.vue
  (create/edit form), views/senior/* (asking for help), views/youth/* (helping),
  layouts/MainLayout.vue (loads the list once for the navbar), e2e/helpboard.spec.js.
*/
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { MAX_ACTIVE_TASKS } from '../lib/points.js'

// One query returns the request plus the requester's and helper's names
const COLUMNS = `id, title, description, category, difficulty, duration, points, is_physical, status,
  requester_id, helper_id, created_at,
  requester:profiles!requester_id(name, block),
  helper:profiles!helper_id(name)`

// Database row -> the shape the pages already use
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
    createdAt: new Date(r.created_at).getTime(),
  }
}

export const useHelpRequestStore = defineStore('helpRequest', () => {
  const auth = useAuthStore()
  const pointsStore = usePointsStore()

  const requests = ref([])
  const loading = ref(false)
  const loadError = ref('')

  // RLS decides which rows come back: open requests plus your own
  async function load() {
    loading.value = true
    loadError.value = ''
    const { data, error } = await supabase
      .from('help_requests').select(COLUMNS).order('created_at', { ascending: false })
    if (error) loadError.value = 'Could not load requests. Please try again.'
    else requests.value = data.map(fromRow)
    loading.value = false
  }

  // Same computed lists as before
  const myRequests = computed(() => requests.value.filter((r) => r.seniorId === auth.user?.id))
  const openRequests = computed(() => requests.value.filter((r) => r.status === 'open' && r.seniorId !== auth.user?.id))
  const myTasks = computed(() => requests.value.filter((r) => r.helperId === auth.user?.id))
  const activeCount = computed(
    () => myTasks.value.filter((r) => r.status === 'accepted' || r.status === 'pending_confirmation').length,
  )
  const atLimit = computed(() => activeCount.value >= MAX_ACTIVE_TASKS)
  const myPoints = computed(() => pointsStore.myPoints)

  function getRequestById(id) {
    return requests.value.find((r) => r.id === id) ?? null
  }

  // Run a database call, reload the list, return { ok } or { ok: false, error }
  async function run(call) {
    const { error } = await call
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }

  const createRequest = (d) =>
    run(supabase.from('help_requests').insert({
      title: d.title, description: d.description, category: d.category,
      difficulty: d.difficulty, duration: d.duration,
    }))

  const updateRequest = (id, d) =>
    run(supabase.from('help_requests').update({
      title: d.title, description: d.description, category: d.category,
      difficulty: d.difficulty, duration: d.duration,
    }).eq('id', id))

  const cancelRequest = (id) => run(supabase.rpc('cancel_help_request', { request_id: id }))
  const markDone = (id) => run(supabase.rpc('mark_task_done', { request_id: id }))
  const withdrawFromTask = (id) => run(supabase.rpc('withdraw_from_task', { request_id: id }))
  const acceptRequest = (id, physicalOk = false) =>
    run(supabase.rpc('accept_help_request', { request_id: id, physical_ok: physicalOk }))

  // The database adds the points to points_ledger itself. Do NOT call awardPoints here,
  // or the points are given twice.
  const confirmDone = (id) => run(supabase.rpc('confirm_help_done', { request_id: id }))

  return {
    requests, loading, loadError,
    myRequests, openRequests, myTasks, activeCount, atLimit, myPoints,
    getRequestById, load,
    createRequest, updateRequest, cancelRequest, confirmDone,
    acceptRequest, markDone, withdrawFromTask,
  }
})
