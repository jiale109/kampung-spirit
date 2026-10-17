<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import RequestForm from '../../components/RequestForm.vue'
import EmptyState from '../../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useHelpRequestStore()

const loaded = ref(false)
const error = ref('')

const request = computed(() => store.getRequestById(route.params.requestId))

onMounted(async () => {
  await store.load()
  loaded.value = true
})

async function save(data) {
  error.value = ''
  const result = await store.updateRequest(request.value.id, data)
  if (result.ok) router.push('/senior')
  else error.value = result.error
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <h1 class="page-title">Edit your request</h1>
    </div>

    <p v-if="!loaded">Loading…</p>

    <!-- Only open requests can be edited -->
    <template v-else-if="request && request.status === 'open'">
      <p v-if="error" class="text-danger">{{ error }}</p>
      <RequestForm :request="request" submit-label="Save changes" @save="save" />
    </template>

    <EmptyState v-else message="This request can no longer be edited.">
      <router-link to="/senior" class="btn btn-primary btn-lg mt-4">Back to my requests</router-link>
    </EmptyState>
  </div>
</template>
