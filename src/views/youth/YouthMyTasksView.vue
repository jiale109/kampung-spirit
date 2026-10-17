<script setup>
import { ref, onMounted } from 'vue'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'

const store = useHelpRequestStore()

const error = ref('')

onMounted(store.load)

async function markDone(request) {
  error.value = ''
  const result = await store.markDone(request.id)
  if (!result.ok) error.value = result.error
}

async function withdraw(request) {
  error.value = ''
  if (!window.confirm('Withdraw from this task? It will go back on the Help Board for others.')) return
  const result = await store.withdrawFromTask(request.id)
  if (!result.ok) error.value = result.error
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">My Tasks</h1>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="store.loadError" class="alert alert-danger" role="alert">{{ store.loadError }}</div>

    <p v-if="store.loading && store.myTasks.length === 0">Loading your tasks…</p>

    <EmptyState v-else-if="store.myTasks.length === 0" message="You have not accepted any tasks yet.">
      <router-link to="/app" class="btn btn-primary btn-lg mt-4">Browse requests</router-link>
    </EmptyState>

    <div v-else class="request-list">
      <RequestCard v-for="request in store.myTasks" :key="request.id" :request="request" :show-helper="false">
        <template #actions>
          <template v-if="request.status === 'accepted'">
            <button class="btn btn-primary btn-lg" data-testid="mark-done"
              @click="markDone(request)">Mark as done</button>
            <button class="btn btn-outline-secondary btn-lg" data-testid="withdraw"
              @click="withdraw(request)">Withdraw</button>
          </template>
          <span v-if="request.status === 'pending_confirmation'" class="request-note">
            Waiting for {{ request.seniorName }} to confirm. Points are released after that.
          </span>
          <span v-if="request.status === 'completed'" class="request-success">
            ✔ You earned {{ request.points }} points
          </span>
          <span v-if="request.status === 'cancelled'" class="request-note">The senior cancelled this request.</span>
        </template>
      </RequestCard>
    </div>
  </div>
</template>
