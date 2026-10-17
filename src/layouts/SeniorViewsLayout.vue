<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

const avatarInitial = computed(() => auth.user.name[0].toUpperCase())

function logout() {
  auth.logout()
  router.push('/landing')
}
</script>

<template>
  <!-- .role-senior makes all text larger on senior pages (see theme.css) -->
  <div class="role-senior">
    <nav class="navbar navbar-expand-xl app-navbar">
      <div class="container">
        <router-link class="navbar-brand" to="/app/requests">🏘️ Kampung Spirit</router-link>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
          aria-controls="navbarNav" aria-expanded="false" aria-label="Open menu">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link class="nav-link" to="/app/requests" exact-active-class="active">My Requests</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/app/hangouts" exact-active-class="active">Hangouts</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/app/skill-swaps" exact-active-class="active">Skill Swaps</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/app/rewards" exact-active-class="active">Rewards</router-link>
            </li>
          </ul>

          <!-- Name dropdown -->
          <ul class="navbar-nav ms-auto">
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
                    <div class="menu-meta">Senior, {{ auth.user.block }}</div>
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
  </div>
</template>
