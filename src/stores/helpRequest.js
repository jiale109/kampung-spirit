/*
  ============================================================================
  GUIDE: Help Board store                                 Owner: Victoria Soh
  ============================================================================
  Today the requests live in the browser (localStorage). To move to Express +
  MongoDB, keep every function name and replace the body with an axios call.
  The pages do not need to change if the return values stay the same.

    createRequest(data)    ->  POST   /requests
    updateRequest(id, d)   ->  PATCH  /requests/:id          (only while status is open)
    cancelRequest(id)      ->  PATCH  /requests/:id/cancel   (open or accepted)
    acceptRequest(id)      ->  POST   /requests/:id/accept   (error if not open, or 2 active)
    markDone(id)           ->  POST   /requests/:id/done     (helper only)
    confirmDone(id)        ->  POST   /requests/:id/confirm  (requesting senior only, awards points)
    loading the lists      ->  GET    /requests              (add a load() action, call it onMounted)

  The server MUST re-check the rules (status order, the 2-active-task limit,
  who is allowed to do what). The checks here only make the page friendlier.

  Mongoose model: HelpRequest { title, description, category, difficulty,
  duration, points, seniorId, helperId, status, createdAt }. status is one of
  open | accepted | pending_confirmation | completed | cancelled.
  Use _id instead of id when the data comes from MongoDB.

  Remember: confirmDone() adds points. When Rewards builds stores/points.js it
  should call awardPoints() here (see the GUIDE in views/rewards/RewardsView.vue).

  Related files: components/RequestCard.vue (the card), components/RequestForm.vue
  (create/edit form), views/app/* and views/app/* (the pages), e2e/helpboard.spec.js.
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
