<script setup>
import { useRouter } from 'vue-router'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import RequestForm from '../../components/RequestForm.vue'

const router = useRouter()
const store = useHelpRequestStore()

function save(data) {
  store.createRequest(data)
  router.push('/senior')
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <h1 class="page-title">What do you need help with?</h1>
    </div>
    <RequestForm submit-label="Post request" @save="save" />
  </div>
</template>
