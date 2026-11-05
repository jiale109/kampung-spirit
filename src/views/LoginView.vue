<script setup>
/*
  Log in                                                 Owner: Reuben Tham
  Log in with email and password (Supabase Auth, see stores/auth.js).
  New people go to the sign-up page (views/RegisterView.vue). The route guard
  in router/index.js sends logged-out people who open an app page here; the
  home page that explains the app is views/LandingView.vue.
*/
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import AuthShell from '../components/AuthShell.vue'

const router = useRouter()
const auth = useAuthStore()

const form = ref({ email: '', password: '' })
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (!form.value.email.trim() || !form.value.password) {
    error.value = 'Please enter your email and password.'
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
  <AuthShell>
    <h1 class="page-title">Welcome back</h1>
    <p class="page-subtitle mb-4">Log in to ask for help or to help a neighbour.</p>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <form class="d-grid gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="form-label">Email</label>
        <!-- type="text" so the admin can type just "admin" (stores/auth.js);
             inputmode still brings up the email keyboard on phones -->
        <input id="email" v-model="form.email" type="text" inputmode="email" class="form-control"
          autocomplete="username" aria-describedby="email-hint" />
        <div id="email-hint" class="form-text">Your email address</div>
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
    <p class="mt-3 mb-0"><router-link to="/landing">← Back to the home page</router-link></p>
  </AuthShell>
</template>
