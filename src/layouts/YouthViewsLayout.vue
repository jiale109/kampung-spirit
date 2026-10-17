<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useHelpRequestStore } from '../stores/helpRequest.js'

const router = useRouter()
const auth = useAuthStore()
const store = useHelpRequestStore()

const avatarInitial = computed(() => auth.user.name[0].toUpperCase())

function logout() {
  auth.logout()
  router.push('/landing')
}

onMounted(store.load)
</script>

<template>
  <nav class="navbar navbar-expand-xl app-navbar">
    <div class="container">
      <router-link class="navbar-brand" to="/youth">🏘️ Kampung Spirit</router-link>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Open menu">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/youth" exact-active-class="active">Help Board</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/youth/tasks" exact-active-class="active">My Tasks</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/youth/hangouts" exact-active-class="active">Hangouts</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/youth/skill-swaps" exact-active-class="active">Skill Swaps</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/youth/rewards" exact-active-class="active">Rewards</router-link>
          </li>
        </ul>

        <!-- Points + name dropdown -->
        <ul class="navbar-nav ms-auto align-items-lg-center gap-2 gap-lg-3">
          <li class="nav-item">
            <span class="points-pill" data-testid="points">⭐ {{ store.myPoints }} pts</span>
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
                  <div class="menu-meta">Youth, {{ auth.user.block }}</div>
                </div>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <router-link class="dropdown-item" to="/youth/profile">Profile</router-link>
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
