<script setup>
/*
  ============================================================================
  GUIDE: Landing page and login                          Owner: Reuben Tham
  ============================================================================
  Today this is a DEMO login: you pick Senior or Youth and an account from
  lib/seed.js, and there is no password. Replace it with real sign up and login.

  1. Add a sign-up page (views/RegisterView.vue, like the exemplar project's)
     with: name, email, password, role (Senior or Youth, use the same big toggle
     as below), block and interests. Add the route in router/index.js next to
     /landing, and link to it from here ("New here? Create an account").
  2. Replace enter() with a real form: email + password, call auth.login() and
     show the error under the form if it fails (copy the alert pattern in
     views/youth/YouthHelpBoardView.vue). Keep the role toggle only for sign up.
  3. Keep the page simple and readable: big inputs, labels above fields (not
     placeholders only), plain error text like "That password is not right."
  4. The route guard in router/index.js already sends logged-out people here.
  5. Update e2e/helpers.js login() to use the new form, so all other tests keep working.
  See also the GUIDE in stores/auth.js.
*/
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useHelpRequestStore } from '../stores/helpRequest.js'
import { users } from '../lib/seed.js'

const router = useRouter()
const auth = useAuthStore()
const store = useHelpRequestStore()

// Which side of the app: 'senior' or 'youth'
const role = ref('senior')
const selectedUserId = ref('s1')

// Only show the demo accounts for the chosen role
const roleUsers = computed(() => users.filter((u) => u.role === role.value))

// One line under the toggle that says what each role is for
const roleHint = computed(() =>
  role.value === 'senior'
    ? 'Ask your neighbours for a hand with everyday tasks.'
    : 'Help seniors nearby and earn points for it.',
)

function chooseRole(newRole) {
  role.value = newRole
  selectedUserId.value = roleUsers.value[0].id
}

function enter() {
  auth.login(selectedUserId.value)
  router.push('/' + role.value)
}
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0 landing-row">

      <!-- Tagline -->
      <div class="col-lg-6 landing-hero">
        <p class="landing-brand">🏘️ Kampung Spirit</p>
        <h1 class="landing-tagline">Neighbours helping neighbours, one small favour at a time.</h1>
      </div>

      <!-- Demo login -->
      <div class="col-lg-6 landing-panel">
        <div class="login-box">
          <h2 class="page-title">Welcome</h2>
          <p class="page-subtitle mb-4">Choose who you are to continue.</p>

          <!-- Senior / Youth toggle -->
          <div class="btn-group w-100" role="group" aria-label="Choose your role">
            <button type="button" class="btn btn-lg btn-outline-primary" :class="{ active: role === 'senior' }"
              :aria-pressed="role === 'senior'" @click="chooseRole('senior')">Beneficiary</button>
            <button type="button" class="btn btn-lg btn-outline-primary" :class="{ active: role === 'youth' }"
              :aria-pressed="role === 'youth'" @click="chooseRole('youth')">Volunteer</button>
          </div>
          <p class="role-hint" aria-live="polite">{{ roleHint }}</p>

          <form @submit.prevent="enter">
            <label for="account" class="form-label">Demo account</label>
            <select id="account" v-model="selectedUserId" class="form-select mb-4">
              <option v-for="u in roleUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
            <button type="submit" class="btn btn-primary btn-lg w-100">Enter</button>
          </form>
        </div>
      </div>

    </div>
  </div>
</template>
