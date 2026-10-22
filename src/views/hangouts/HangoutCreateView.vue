<script setup>
/*
  Propose a hangout page                                 Owner: Clarence Tay
  Thin wrapper, like views/senior/SeniorCreateRequestView.vue: it shows
  HangoutForm.vue, sends the result to the store and goes back to the list.
*/
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHangoutStore } from '../../stores/hangout.js'
import HangoutForm from '../../components/HangoutForm.vue'

const router = useRouter()
const store = useHangoutStore()

const error = ref('')

async function save(data) {
  error.value = ''
  const result = await store.createHangout(data)
  if (result.ok) router.push('/app/hangouts')
  else error.value = result.error
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Propose a hangout</h1>
        <p class="page-subtitle">Invite your neighbours to something small and easy.</p>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <HangoutForm @save="save" />
  </div>
</template>
