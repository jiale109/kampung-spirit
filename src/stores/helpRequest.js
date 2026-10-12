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
  (create/edit form), views/senior/* and views/youth/* (the pages), e2e/helpboard.spec.js.
*/
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { seedRequests, seedPoints } from '../lib/seed.js'
import { calcPoints, MAX_ACTIVE_TASKS } from '../lib/points.js'

const STORAGE_KEY = 'kampung-helpboard'

// Status of a request moves like this:
// open -> accepted -> pending_confirmation -> completed   (or cancelled)

export const useHelpRequestStore = defineStore('helpRequest', () => {
  const auth = useAuthStore()

  // Load from the browser if we have saved data, otherwise start with the sample data
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const requests = ref(saved ? saved.requests : seedRequests())
  const points = ref(saved ? saved.points : seedPoints()) // { youthId: points }

  // Save to the browser whenever something changes
  watch([requests, points], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ requests: requests.value, points: points.value }))
  }, { deep: true })

  // ---- What each person sees ----

  // Senior: their own requests
  const myRequests = computed(() => requests.value.filter((r) => r.seniorId === auth.user?.id))

  // Youth: every request that is still waiting for a helper
  const openRequests = computed(() => requests.value.filter((r) => r.status === 'open'))

  // Youth: tasks they accepted
  const myTasks = computed(() => requests.value.filter((r) => r.helperId === auth.user?.id))

  // Active = accepted but not yet confirmed by the senior
  const activeCount = computed(() => {
    return myTasks.value.filter((r) => r.status === 'accepted' || r.status === 'pending_confirmation').length
  })
  const atLimit = computed(() => activeCount.value >= MAX_ACTIVE_TASKS)

  const myPoints = computed(() => points.value[auth.user?.id] ?? 0)

  function getRequestById(id) {
    return requests.value.find((r) => r.id === id) ?? null
  }

  // ---- Senior actions ----

  function createRequest({ title, description, category, difficulty, duration }) {
    requests.value.unshift({
      id: 'r' + Date.now(),
      title,
      description,
      category,
      difficulty,
      duration,
      points: calcPoints(difficulty, duration),
      seniorId: auth.user.id,
      seniorName: auth.user.name,
      block: auth.user.block,
      status: 'open',
      helperId: null,
      helperName: null,
      createdAt: Date.now(),
    })
  }

  function updateRequest(id, updates) {
    const request = getRequestById(id)
    Object.assign(request, updates, { points: calcPoints(updates.difficulty, updates.duration) })
  }

  function cancelRequest(id) {
    getRequestById(id).status = 'cancelled'
  }

  // The senior confirms the help happened, so the helper gets the points
  function confirmDone(id) {
    const request = getRequestById(id)
    if (request.status !== 'pending_confirmation') return
    request.status = 'completed'
    points.value[request.helperId] = (points.value[request.helperId] ?? 0) + request.points
  }

  // ---- Youth actions ----

  function acceptRequest(id) {
    const request = getRequestById(id)
    if (request.status !== 'open') {
      return { ok: false, error: 'Sorry, this request is no longer open.' }
    }
    if (atLimit.value) {
      return { ok: false, error: `You can only have ${MAX_ACTIVE_TASKS} active tasks. Finish one first.` }
    }
    request.status = 'accepted'
    request.helperId = auth.user.id
    request.helperName = auth.user.name
    return { ok: true }
  }

  // The youth says they are done, now the senior must confirm
  function markDone(id) {
    getRequestById(id).status = 'pending_confirmation'
  }

  // The volunteer backs out of an accepted task. It goes back on the board for others.
  function withdrawFromTask(id) {
    const request = getRequestById(id)
    if (request.status !== 'accepted' || request.helperId !== auth.user.id) return
    request.status = 'open'
    request.helperId = null
    request.helperName = null
  }

  // Put the sample data back (for demos)
  function reset() {
    requests.value = seedRequests()
    points.value = seedPoints()
  }

  return {
    requests, points,
    myRequests, openRequests, myTasks, activeCount, atLimit, myPoints,
    getRequestById,
    createRequest, updateRequest, cancelRequest, confirmDone,
    acceptRequest, markDone, withdrawFromTask, reset,
  }
})
