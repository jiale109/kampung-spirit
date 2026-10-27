<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useHelpRequestStore, isPastTime, formatNeededAt } from '../../stores/helpRequest.js'
import { categories, MAX_ACTIVE_TASKS } from '../../lib/points.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'

const store = useHelpRequestStore()

const selectedCategory = ref('')
const sortBy = ref('soonest')
const acceptedTitle = ref('')   
const error = ref('')

const successAlert = ref(null)
const errorAlert = ref(null)


// The request waiting for "Yes, I can help" in the modal
const requestToAccept = ref(null)

// "Sat 25 Oct, 3:00 PM at Eunos CC entrance." plus a warning for physical tasks
const acceptMessage = computed(() => {
  const r = requestToAccept.value
  const when = `${formatNeededAt(r.neededAt)} at ${r.location}.`
  return r.isPhysical ? `${when} This task needs physical effort.` : when
})

const busyId = ref(null)

onMounted(store.load)

const filteredRequests = computed(() => {
  const list = store.openRequests.filter((r) =>
    !isPastTime(r) && (selectedCategory.value === '' || r.category === selectedCategory.value))

  if (sortBy.value === 'points') return [...list].sort((a, b) => b.points - a.points)
  if (sortBy.value === 'shortest') return [...list].sort((a, b) => a.duration - b.duration)
  if (sortBy.value === 'soonest') return [...list].sort((a, b) => a.neededAt - b.neededAt)
  return list
})

const firstLoad = computed(() => store.loading && store.openRequests.length === 0)
const countText = computed(() => `${filteredRequests.value.length} request${filteredRequests.value.length === 1 ? '' : 's'}`)

function accept(request) {
  acceptedTitle.value = ''
  error.value = ''

  requestToAccept.value = request
}

// "Yes, I can help" also counts as agreeing to the physical effort
function confirmAccept() {
  const request = requestToAccept.value
  requestToAccept.value = null
  doAccept(request, request.isPhysical)
}

async function doAccept(request, physicalOk) {
  busyId.value = request.id
  try {
    const result = await store.acceptRequest(request.id, physicalOk)
    if (result.ok) {
      acceptedTitle.value = request.title
    } else {
      error.value = result.error
    }
 
    await nextTick()
    const alert = result.ok ? successAlert.value : errorAlert.value
    alert?.focus()
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Help your neighbours</h1>
        <p class="page-subtitle">Pick a request you can help with.</p>
      </div>
      <span class="count-pill" :class="{ 'is-full': store.atLimit }" data-testid="active-count">
        Active tasks: {{ store.activeCount }} / {{ MAX_ACTIVE_TASKS }}
      </span>
    </div>

    <div class="row g-3 mb-2">
      <div class="col-sm-6">
        <label for="category-filter" class="form-label">Filter by category</label>
        <select id="category-filter" v-model="selectedCategory" class="form-select">
          <option value="">All Categories</option>
          <option v-for="c in categories" :key="c.name" :value="c.name">{{ c.icon }} {{ c.name }}</option>
        </select>
      </div>
      <div class="col-sm-6">
        <label for="sort-by" class="form-label">Sort by</label>
        <select id="sort-by" v-model="sortBy" class="form-select">
          <option value="soonest">Soonest first</option>
          <option value="newest">Newest first</option>
          <option value="points">Most points</option>
          <option value="shortest">Shortest time</option>
        </select>
      </div>
    </div>
    <p class="request-count" aria-live="polite" data-testid="request-count">
      <template v-if="!firstLoad && !store.loadError">{{ countText }}</template>
    </p>

    <div v-if="acceptedTitle" ref="successAlert" class="alert alert-success accept-alert" role="status"
      tabindex="-1" data-testid="accept-success">
      <span>You accepted "{{ acceptedTitle }}". It is now in My Tasks.</span>
      <span class="accept-alert-actions">
        <router-link to="/app/tasks" class="btn btn-primary">View My Tasks</router-link>
        <button type="button" class="btn btn-outline-success alert-close" aria-label="Close message"
          data-testid="close-message" @click="acceptedTitle = ''">✕</button>
      </span>
    </div>
    <div v-if="error" ref="errorAlert" class="alert alert-danger" role="alert" tabindex="-1">{{ error }}</div>
    <div v-if="store.atLimit" class="alert alert-warning">
      You have {{ MAX_ACTIVE_TASKS }} active tasks. Finish one before accepting another.
    </div>

    <p v-if="firstLoad">Loading requests…</p>

    <div v-else-if="store.loadError" class="alert alert-danger load-error" role="alert">
      {{ store.loadError }}
      <button type="button" class="btn btn-outline-danger" @click="store.load()">Try again</button>
    </div>

    <EmptyState v-else-if="filteredRequests.length === 0 && selectedCategory" message="No requests in this category right now.">
      <button type="button" class="btn btn-primary btn-lg mt-4" @click="selectedCategory = ''">Show all categories</button>
    </EmptyState>

    <EmptyState v-else-if="filteredRequests.length === 0" message="No open requests here right now. Check back soon!" />

    <div v-else class="request-list">
      <RequestCard v-for="request in filteredRequests" :key="request.id" :request="request" hide-status compact show-waiting>
        <template #actions>
          <button class="btn btn-primary btn-lg" data-testid="accept" :disabled="store.atLimit || busyId !== null"
            @click="accept(request)">
            {{ busyId === request.id ? 'Saving…' : 'I can help' }}
          </button>
        </template>
      </RequestCard>
    </div>

    <ConfirmModal v-if="requestToAccept" title="Can you make it?" :message="acceptMessage"
      confirm-label="Yes, I can help" cancel-label="Not now" testid="confirm-accept"
      @confirm="confirmAccept" @cancel="requestToAccept = null" />
  </div>
</template>

<style scoped>
.request-count {
  min-height: 1.5em;               
  margin-bottom: 1.5rem;
  font-weight: 600;
  color: var(--ks-muted);
}

.accept-alert {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.accept-alert-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.alert-close {
  min-width: 3rem;
  min-height: 3rem;
}

.alert[tabindex='-1']:focus {
  outline: 3px solid var(--ks-teal-dark);
  outline-offset: 3px;
}

.load-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}
</style>
