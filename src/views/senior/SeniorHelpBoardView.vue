<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'

const auth = useAuthStore()
const store = useHelpRequestStore()

const requestToCancel = ref(null)
const message = ref('')
const error = ref('')

async function confirmDone(request) {
  message.value = ''
  error.value = ''
  const result = await store.confirmDone(request.id)
  if (result.ok) {
    message.value = `Thank you! ${request.helperName} earned ${request.points} points.`
  } else {
    error.value = result.error
  }
}

async function doCancel() {
  const id = requestToCancel.value
  requestToCancel.value = null
  message.value = ''
  error.value = ''
  const result = await store.cancelRequest(id)
  if (!result.ok) error.value = result.error
}

onMounted(store.load)
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Hello, {{ auth.user.name }}</h1>
        <p class="page-subtitle">Your help requests</p>
      </div>
      <!-- When there are no requests, the empty state below has the button instead -->
      <router-link v-if="store.myRequests.length > 0" to="/app/requests/create" class="btn btn-primary btn-lg">+ Ask for Help</router-link>
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="store.loadError" class="alert alert-danger" role="alert">{{ store.loadError }}</div>

    <!-- Loading (only while there is nothing to show yet) -->
    <p v-if="store.loading && store.myRequests.length === 0">Loading your requests…</p>

    <!-- Empty state -->
    <EmptyState v-if="store.myRequests.length === 0" message="You have not asked for help yet. It is okay to ask!">
      <router-link to="/app/requests/create" class="btn btn-primary btn-lg mt-4">+ Ask for Help</router-link>
    </EmptyState>

    <!-- Request list -->
    <div v-else class="request-list">
      <RequestCard v-for="request in store.myRequests" :key="request.id" :request="request" :show-requester="false"
        :open="request.status === 'pending_confirmation'">
        <template #actions>
          <button v-if="request.status === 'pending_confirmation'" class="btn btn-primary btn-lg"
            data-testid="confirm" @click="confirmDone(request)">
            ✔ Yes, {{ request.helperName }} helped me
          </button>
          <router-link v-if="request.status === 'open'" :to="`/app/requests/edit/${request.id}`"
            class="btn btn-outline-primary">Edit</router-link>
          <button v-if="request.status === 'open' || request.status === 'accepted'" class="btn btn-outline-danger"
            data-testid="cancel" @click="requestToCancel = request.id">Cancel request</button>
          <span v-if="request.status === 'accepted'" class="request-note">{{ request.helperName }} is on the way.</span>
        </template>
      </RequestCard>
    </div>

    <!-- Cancel confirmation modal -->
    <div v-if="requestToCancel" class="modal show" style="display: block;" role="dialog" aria-modal="true"
      aria-labelledby="cancel-title" @click.self="requestToCancel = null">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="cancel-title" class="modal-title">Cancel this request?</h2>
            <button type="button" class="btn-close" aria-label="Close" @click="requestToCancel = null"></button>
          </div>
          <div class="modal-body">
            Nobody will be able to help with this request anymore.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="requestToCancel = null">Keep it</button>
            <button type="button" class="btn btn-danger" data-testid="confirm-cancel" @click="doCancel">Yes, cancel</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="requestToCancel" class="modal-backdrop show"></div>
  </div>
</template>
