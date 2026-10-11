<script setup>
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'

const store = useHelpRequestStore()
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">My Tasks</h1>
    </div>

    <EmptyState v-if="store.myTasks.length === 0" message="You have not accepted any tasks yet.">
      <router-link to="/youth" class="btn btn-primary btn-lg mt-4">Browse requests</router-link>
    </EmptyState>

    <div v-else class="request-list">
      <RequestCard v-for="request in store.myTasks" :key="request.id" :request="request" :show-helper="false">
        <template #actions>
          <button v-if="request.status === 'accepted'" class="btn btn-primary btn-lg" data-testid="mark-done"
            @click="store.markDone(request.id)">Mark as done</button>
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
