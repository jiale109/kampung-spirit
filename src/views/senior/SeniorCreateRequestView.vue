<script setup>
import { ref, onMounted } from 'vue'
import { showElement } from '../../composables/useScrollToError.js'
import { useRouter } from 'vue-router'
import { useHelpRequestStore, DAILY_LIMIT_NOTE } from '../../stores/helpRequest.js'
import RequestForm from '../../components/RequestForm.vue'
import { useTelegramPrompt } from '../../composables/useTelegramPrompt.js'

const router = useRouter()
const store = useHelpRequestStore()
const { askToLinkTelegram } = useTelegramPrompt()

const error = ref('')
const errorEl = ref(null)
const busy = ref(false)
async function save(data) {
  error.value = ''
  busy.value = true
  try {
    const result = await store.createRequest(data)
    if (result.ok) {
      askToLinkTelegram('request')
      router.push('/app/requests')
    } else {
      error.value = result.error
      showElement(() => errorEl.value)
    }
  } finally {
    busy.value = false
  }
}

// Load my requests, so the daily limit below is up to date
onMounted(store.load)
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <h1 class="page-title">What do you need help with?</h1>
    </div>
    <!-- Also shows the database's own message, e.g. if the limit was reached in another tab -->
    <p v-if="error" ref="errorEl" class="text-danger" role="alert" data-testid="create-error">{{ error }}</p>
    <p v-if="store.loading && store.requests.length === 0">Loading…</p>
    <div v-else-if="store.dailyLimitReached" class="limit-box">
      <p v-if="!error" class="limit-note" data-testid="daily-limit-note">{{ DAILY_LIMIT_NOTE }}</p>
      <router-link to="/app/requests" class="btn btn-primary btn-lg">Back to my requests</router-link>
    </div>
    <RequestForm v-else submit-label="Post request" :busy="busy" @save="save" />
  </div>
</template>

<style scoped>
.limit-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.25rem;
}

.limit-note {
  margin: 0;
  font-weight: 600;
}

.limit-box .btn {
  min-height: 3rem;
}
</style>
