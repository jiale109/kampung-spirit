<script setup>
import { ref, computed, onMounted } from 'vue'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'

const store = useHelpRequestStore()

const PAST = ['completed', 'cancelled']
const activeTasks = computed(() => store.myTasks.filter((r) => !PAST.includes(r.status)))
const pastTasks = computed(() => store.myTasks.filter((r) => PAST.includes(r.status)))

const error = ref('')
const taskToWithdraw = ref(null)

const busy = ref('')

onMounted(store.load)

async function run(key, action) {
  error.value = ''
  busy.value = key
  try {
    const result = await action()
    if (!result.ok) error.value = result.error
  } finally {
    busy.value = ''
  }
}

function markDone(request) {
  run(`done-${request.id}`, () => store.markDone(request.id))
}

function doWithdraw() {
  const id = taskToWithdraw.value
  taskToWithdraw.value = null
  run(`withdraw-${id}`, () => store.withdrawFromTask(id))
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">My Tasks</h1>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <!-- Only one of these shows: loading, could not load, nothing yet, or the list -->
    <p v-if="store.loading && store.myTasks.length === 0">Loading your tasks…</p>

    <div v-else-if="store.loadError" class="alert alert-danger load-error" role="alert">
      {{ store.loadError }}
      <button type="button" class="btn btn-outline-danger" @click="store.load()">Try again</button>
    </div>

    <EmptyState v-else-if="store.myTasks.length === 0" message="You have not accepted any tasks yet.">
      <router-link to="/app" class="btn btn-primary btn-lg mt-4">Browse requests</router-link>
    </EmptyState>

    <template v-else>
      <!-- Active: accepted or waiting for the senior to confirm -->
      <section aria-labelledby="active-heading" data-testid="active-tasks">
        <h2 id="active-heading" class="h4 fw-bold mb-3">Active</h2>
        <p v-if="activeTasks.length === 0">You have no active tasks right now.</p>
        <div v-else class="request-list">
          <RequestCard v-for="request in activeTasks" :key="request.id" :request="request" :show-helper="false">
            <template #actions>
              <template v-if="request.status === 'accepted'">
                <button class="btn btn-primary btn-lg" data-testid="mark-done" :disabled="busy !== ''"
                  @click="markDone(request)">{{ busy === `done-${request.id}` ? 'Saving…' : 'Mark as done' }}</button>
                <button class="btn btn-outline-secondary btn-lg" data-testid="withdraw" :disabled="busy !== ''"
                  @click="taskToWithdraw = request.id">{{ busy === `withdraw-${request.id}` ? 'Saving…' : 'Withdraw' }}</button>
              </template>
              <span v-if="request.status === 'pending_confirmation'" class="request-note">
                Waiting for {{ request.seniorName }} to confirm. Points are released after that.
              </span>
            </template>
          </RequestCard>
        </div>
      </section>

      <!-- Past: completed or cancelled (nothing more to do, so no buttons) -->
      <section v-if="pastTasks.length > 0" class="mt-5" aria-labelledby="past-heading" data-testid="past-tasks">
        <h2 id="past-heading" class="h4 fw-bold mb-3">Past</h2>
        <div class="request-list">
          <RequestCard v-for="request in pastTasks" :key="request.id" :request="request" :show-helper="false">
            <template #actions>
              <span v-if="request.status === 'completed'" class="request-success">
                ✔ You earned {{ request.points }} points
              </span>
              <span v-if="request.status === 'cancelled'" class="request-note">The senior cancelled this request.</span>
            </template>
          </RequestCard>
        </div>
      </section>
    </template>

    <ConfirmModal v-if="taskToWithdraw" title="Withdraw from this task?"
      message="It will go back on the Help Board for others."
      confirm-label="Yes, withdraw" cancel-label="Keep task" danger testid="confirm-withdraw"
      @confirm="doWithdraw" @cancel="taskToWithdraw = null" />
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}
</style>
