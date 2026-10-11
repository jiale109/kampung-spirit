<script setup>
import { ref, computed } from 'vue'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import { categories, MAX_ACTIVE_TASKS } from '../../lib/points.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'

const store = useHelpRequestStore()

const selectedCategory = ref('')
const sortBy = ref('newest')
const message = ref('')
const error = ref('')

// Apply the category filter, then the sort order
const filteredRequests = computed(() => {
  const list = store.openRequests.filter((r) => selectedCategory.value === '' || r.category === selectedCategory.value)

  if (sortBy.value === 'points') return [...list].sort((a, b) => b.points - a.points)
  if (sortBy.value === 'shortest') return [...list].sort((a, b) => a.duration - b.duration)
  return list
})

function accept(request) {
  message.value = ''
  error.value = ''

  const result = store.acceptRequest(request.id)
  if (result.ok) {
    message.value = `You accepted "${request.title}". Find it under My Tasks.`
  } else {
    error.value = result.error
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

    <!-- Filter & Sort (not a .card, so it is not counted as a request) -->
    <div class="row g-3 mb-4">
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
          <option value="newest">Newest first</option>
          <option value="points">Most points</option>
          <option value="shortest">Shortest time</option>
        </select>
      </div>
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="store.atLimit" class="alert alert-warning">
      You have {{ MAX_ACTIVE_TASKS }} active tasks. Finish one before accepting another.
    </div>

    <EmptyState v-if="filteredRequests.length === 0" message="No open requests here right now. Check back soon!" />

    <div v-else class="request-list">
      <RequestCard v-for="request in filteredRequests" :key="request.id" :request="request" hide-status>
        <template #actions>
          <button class="btn btn-primary btn-lg" data-testid="accept" :disabled="store.atLimit" @click="accept(request)">
            I can help
          </button>
        </template>
      </RequestCard>
    </div>
  </div>
</template>
