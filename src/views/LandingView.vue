<script setup>
/*
  Landing page and login                                 Owner: Reuben Tham
  Log in with email and password (Supabase Auth, see stores/auth.js).
  New people go to the sign-up page (views/RegisterView.vue).
  The route guard in router/index.js sends logged-out people here.
*/
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()

const form = ref({ email: '', password: '' })
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (!form.value.email.trim() || !form.value.password) {
    error.value = 'Please write your email and password.'
    return
  }

  busy.value = true
  const result = await auth.login({ email: form.value.email.trim(), password: form.value.password })
  busy.value = false

  if (result.ok) router.push(auth.homePath)
  else error.value = result.error
}
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0 landing-row">

      <!-- Tagline -->
      <div class="col-lg-6 landing-hero">
        <!-- add better icon here beside kampung spirit ? -->
        <p class="landing-brand"><BrandMark :size="128" />Kampung Spirit</p>
        <h1 class="landing-tagline">Neighbours helping neighbours, one small favour at a time.</h1>
      </div>

      <!-- Log in -->
      <div class="col-lg-6 landing-panel">
        <div class="login-box">
          <h2 class="page-title">Welcome</h2>
          <p class="page-subtitle mb-4">Log in to ask for help or to help a neighbour.</p>

          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

          <form class="d-grid gap-4" novalidate @submit.prevent="submit">
            <div>
              <label for="email" class="form-label">Email</label>
              <input id="email" v-model="form.email" type="email" class="form-control" autocomplete="email" />
            </div>
            <div>
              <label for="password" class="form-label">Password</label>
              <input id="password" v-model="form.password" type="password" class="form-control"
                autocomplete="current-password" />
            </div>
            <button type="submit" class="btn btn-primary btn-lg w-100" :disabled="busy">
              {{ busy ? 'Logging in…' : 'Log in' }}
            </button>
          </form>

          <p class="mt-4 mb-0">New here? <router-link to="/register">Create an account</router-link></p>
        </div>
      </div>

    </div>
  </div>
</template>
