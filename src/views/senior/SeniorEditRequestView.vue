<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useHelpRequestStore } from '../../stores/helpRequest.js'
import RequestForm from '../../components/RequestForm.vue'
import EmptyState from '../../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useHelpRequestStore()

const request = store.getRequestById(route.params.requestId)

function save(data) {
  store.updateRequest(request.id, data)
  router.push('/senior')
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <h1 class="page-title">Edit your request</h1>
    </div>

    <!-- Only open requests can be edited -->
    <RequestForm v-if="request && request.status === 'open'" :request="request" submit-label="Save changes" @save="save" />
    <EmptyState v-else message="This request can no longer be edited.">
      <router-link to="/senior" class="btn btn-primary btn-lg mt-4">Back to my requests</router-link>
    </EmptyState>
  </div>
</template>
