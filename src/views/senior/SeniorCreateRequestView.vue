<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import RequestForm from '../../components/RequestForm.vue'

const router = useRouter()
const store = useHelpRequestStore()

const error = ref('')
const busy = ref(false)
async function save(data) {
  error.value = ''
  busy.value = true
  try {
    const result = await store.createRequest(data)
    if (result.ok) router.push('/app/requests')
    else error.value = result.error
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <h1 class="page-title">What do you need help with?</h1>
    </div>
    <p v-if="error" class="text-danger">{{ error }}</p>
    <RequestForm submit-label="Post request" :busy="busy" @save="save" />
  </div>
</template>
