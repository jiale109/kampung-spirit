<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useHelpRequestStore } from '../stores/helpRequest.js'
import { usePointsStore } from '../stores/points.js'
import { applyLargeText } from '../lib/profile.js'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()
const store = useHelpRequestStore()
// The navbar balance comes from the points store, the same one Rewards and Profile use
const points = usePointsStore()

const avatarInitial = computed(() => auth.user.name[0].toUpperCase())

// "Use large text" from the profile page (see lib/profile.js). Applied when a
// logged-in page opens, and taken off again when this layout closes, so the
// landing page is never left with it.
onMounted(() => applyLargeText(auth.user?.large_text))
onUnmounted(() => applyLargeText(false))

// Load requests once here so the active-task count is right on every page
onMounted(store.load)

async function logout() {
  await auth.logout()
  router.push('/landing')
}
</script>

<template>
  <nav class="navbar navbar-expand-xl app-navbar">
    <div class="container">
      <!-- add better icon beside kampung spirit ? -->
      <router-link class="navbar-brand" :to="auth.homePath"><BrandMark />Kampung Spirit</router-link>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Open menu">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <!-- Ask for help (the old Senior home page) -->
          <li class="nav-item">
            <router-link class="nav-link" to="/app/requests" active-class="active">My Requests</router-link>
          </li>
          <!-- Help others (the old Youth home page). exact so it is not lit up on every /app page -->
          <li class="nav-item">
            <router-link class="nav-link" to="/app" exact-active-class="active">Help Board</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/app/tasks" active-class="active">My Tasks</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/app/hangouts" active-class="active">Hangouts</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/app/skill-swaps" active-class="active">Skill Swaps</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/app/rewards" active-class="active">Rewards</router-link>
          </li>
        </ul>

        <!-- Points + name dropdown -->
        <ul class="navbar-nav ms-auto align-items-lg-center gap-2 gap-lg-3">
          <li class="nav-item">
            <span class="points-pill" data-testid="points">⭐ {{ points.myPoints }} pts</span>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link user-toggle dropdown-toggle d-flex align-items-center gap-2" href="#" role="button"
              data-bs-toggle="dropdown" aria-expanded="false">
              <span class="avatar-circle" aria-hidden="true">{{ avatarInitial }}</span>
              <span class="user-name" data-testid="username">{{ auth.user.name }}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <div class="dropdown-header">
                  <div class="fw-bold">{{ auth.user.name }}</div>
                  <div class="menu-meta">{{ auth.user.block }}</div>
                </div>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <router-link class="dropdown-item" to="/app/profile">Profile</router-link>
              </li>
              <li>
                <button class="dropdown-item text-danger" @click="logout">Log out</button>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="app-main">
    <div class="container app-container">
      <router-view />
    </div>
  </main>
</template>