<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useHelpRequestStore, isPastTime, formatNeededAt } from '../../stores/helpRequest.js'
import EmptyState from '../../components/EmptyState.vue'
import RequestCard from '../../components/RequestCard.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'

const auth = useAuthStore()
const store = useHelpRequestStore()


const PAST = ['completed', 'cancelled']

const needsAction = (r) => (r.status === 'pending_confirmation' ? 0 : isPastTime(r) ? 1 : 2)
const activeRequests = computed(() => store.myRequests
  .filter((r) => !PAST.includes(r.status))
  .sort((a, b) => needsAction(a) - needsAction(b) || a.neededAt - b.neededAt))
const pastRequests = computed(() => store.myRequests.filter((r) => PAST.includes(r.status)))

const requestToCancel = ref(null)
const message = ref('')
const error = ref('')

const successAlert = ref(null)

// If someone already agreed to help, say so: they will see the cancel in their tasks
const cancelMessage = computed(() => {
  const request = store.myRequests.find((r) => r.id === requestToCancel.value)
  if (request?.status === 'accepted') {
    return `${request.helperName} has already agreed to help. If you cancel, they will see it as cancelled in their tasks.`
  }
  return 'Nobody will be able to help with this request anymore.'
})

const busy = ref('')

async function confirmDone(request) {
  message.value = ''
  error.value = ''
  busy.value = `confirm-${request.id}`
  try {
    const result = await store.confirmDone(request.id)
    if (result.ok) {
      message.value = `Thank you! ${request.helperName} earned ${request.points} points.`
      await nextTick()
      successAlert.value?.focus()
    } else {
      error.value = result.error
    }
  } finally {
    busy.value = ''
  }
}

async function doCancel() {
  const id = requestToCancel.value
  requestToCancel.value = null
  message.value = ''
  error.value = ''
  busy.value = `cancel-${id}`
  try {
    const result = await store.cancelRequest(id)
    if (!result.ok) error.value = result.error
  } finally {
    busy.value = ''
  }
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
      <router-link v-if="store.myRequests.length > 0" to="/app/requests/create" class="btn btn-primary btn-lg">+ Ask for Help</router-link>
    </div>

    <div v-if="message" ref="successAlert" class="alert alert-success closable-alert" role="status" tabindex="-1"
      data-testid="confirm-success">
      <span>{{ message }}</span>
      <button type="button" class="btn btn-outline-success alert-close" aria-label="Close message"
        data-testid="close-message" @click="message = ''">✕</button>
    </div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <p v-if="store.loading && store.myRequests.length === 0">Loading your requests…</p>

    <div v-else-if="store.loadError" class="alert alert-danger load-error" role="alert">
      {{ store.loadError }}
      <button type="button" class="btn btn-outline-danger" @click="store.load()">Try again</button>
    </div>

    <EmptyState v-else-if="store.myRequests.length === 0" message="You have not asked for help yet. It is okay to ask!">
      <router-link to="/app/requests/create" class="btn btn-primary btn-lg mt-4">+ Ask for Help</router-link>
    </EmptyState>

    <template v-else>
      <section aria-labelledby="active-heading" data-testid="active-requests">
        <h2 id="active-heading" class="h4 fw-bold mb-3">Active</h2>
        <p v-if="activeRequests.length === 0">You have no active requests right now.</p>
        <div v-else class="request-list">
          <!-- Always open, so the helper note, progress and buttons never hide behind a tap -->
          <RequestCard v-for="request in activeRequests" :key="request.id" :request="request" :show-requester="false"
            :open="true" viewer="requester">
            <template v-if="isPastTime(request)" #notice>
              <span data-testid="past-time">⚠ Time passed. Please choose a new time.</span>
              <router-link :to="`/app/requests/edit/${request.id}`" class="btn btn-primary">Reschedule</router-link>
            </template>
            <template #actions>
              <button v-if="request.status === 'pending_confirmation'" class="btn btn-primary btn-lg"
                data-testid="confirm" :disabled="busy !== ''" @click="confirmDone(request)">
                {{ busy === `confirm-${request.id}` ? 'Saving…' : `✔ Yes, ${request.helperName} helped me` }}
              </button>
              <router-link v-if="request.status === 'open'" :to="`/app/requests/edit/${request.id}`"
                class="btn btn-outline-primary">Edit</router-link>
              <button v-if="request.status === 'open' || request.status === 'accepted'" class="btn btn-outline-danger"
                data-testid="cancel" :disabled="busy !== ''" @click="requestToCancel = request.id">
                {{ busy === `cancel-${request.id}` ? 'Saving…' : 'Cancel request' }}
              </button>
              <span v-if="request.status === 'accepted'" class="request-note">
                {{ request.helperName }} will help on {{ formatNeededAt(request.neededAt) }}.
              </span>
            </template>
          </RequestCard>
        </div>
      </section>

      <section v-if="pastRequests.length > 0" class="mt-5" aria-labelledby="past-heading" data-testid="past-requests">
        <h2 id="past-heading" class="h4 fw-bold mb-3">Past</h2>
        <div class="request-list">
          <RequestCard v-for="request in pastRequests" :key="request.id" :request="request" :show-requester="false"
            viewer="requester" />
        </div>
      </section>
    </template>

    <ConfirmModal v-if="requestToCancel" title="Cancel this request?"
      :message="cancelMessage"
      confirm-label="Yes, cancel" cancel-label="Keep it" danger testid="confirm-cancel"
      @confirm="doCancel" @cancel="requestToCancel = null" />
  </div>
</template>

<style scoped>
.closable-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.alert[tabindex='-1']:focus {
  outline: 3px solid var(--ks-teal-dark);
  outline-offset: 3px;
}

.alert-close {
  flex-shrink: 0;
  min-width: 3rem;
  min-height: 3rem;
}

.load-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}
</style>
