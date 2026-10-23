`<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SkillSwapForm from '../../components/SkillSwapForm.vue'
import { useSkillSwapStore } from '../../stores/skillSwap'

const route = useRoute()
const router = useRouter()
const store = useSkillSwapStore()

const serverError = ref('')

// /senior/skill-swaps/new -> /senior/skill-swaps (works for /youth too)
const listPath = computed(() => route.path.replace(/\/new\/?$/, ''))

const saving = ref(false)

async function onSubmit(data) {
  if (saving.value) return // ignore a second press while saving
  saving.value = true
  serverError.value = ''
  const result = await store.createSession(data)
  saving.value = false
  if (!result.ok) {
    serverError.value = result.error
    return
  }
  router.push({ path: listPath.value, query: { created: '1' } })
}
</script>

<template>
  <div class="form-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Host a session</h1>
        <p class="page-subtitle">Tell your neighbours what you would like to share.</p>
      </div>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">Back to Skill Swaps</RouterLink>
    </div>

    <SkillSwapForm :cancel-to="listPath" :server-error="serverError" @submit="onSubmit" />
  </div>
</template>