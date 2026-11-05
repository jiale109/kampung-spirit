<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// The same Bootstrap file main.js loads, so this is the very Collapse the
// toggler button uses. (Under Vite the bundle is not put on window.bootstrap,
// and importing bootstrap/js/dist/collapse would be a second copy that does
// not know about the toggler's instance.)
import { Collapse } from 'bootstrap/dist/js/bootstrap.bundle.min.js'
import { useAuthStore } from '../stores/auth.js'
import { useHelpRequestStore } from '../stores/helpRequest.js'
import { usePointsStore } from '../stores/points.js'
import { applyLargeText, avatarSrc, avatarWalkSrc } from '../lib/profile.js'
import BrandMark from '../components/BrandMark.vue'
import TelegramPrompt from '../components/TelegramPrompt.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const store = useHelpRequestStore()
// The navbar balance comes from the points store, the same one Rewards and Profile use
const points = usePointsStore()

const avatarInitial = computed(() => auth.user.name[0].toUpperCase())

/*
  The walker: the person's own avatar strolling along the navbar.

  Off unless they switched it on in their profile, and never drawn at all
  until they have chosen a look, so there is nothing to walk by default.

  It is decorative and says nothing the page does not already say, so it is
  hidden from screen readers. theme.css also stops it for anyone whose
  computer asks for less movement (prefers-reduced-motion).
*/
/*
  The avatar the person built in Edit profile. It does two jobs: their
  picture on the chip at the right of the navbar, and the standing frame of
  the walker below.

  '' until they have chosen BOTH a gender and a skin tone. The chip then
  falls back to the first letter of their name, and the walker is not drawn
  at all - see showWalker.
*/
const avatarPicture = computed(() =>
  avatarSrc(auth.user.age_group, auth.user.gender, auth.user.skin_tone),
)

// The other half of the stride: the same person mid-step
const walkerStep = computed(() =>
  avatarWalkSrc(auth.user.age_group, auth.user.gender, auth.user.skin_tone),
)

// Declared AFTER the two above, because it reads one of them. A computed body
// does not run until something looks at it, so the other order happens to
// work, but only by luck: reading this during setup would then blow up.
const showWalker = computed(() => auth.user.show_walker === true && avatarPicture.value !== '')

// "Use large text" from the profile page (see lib/profile.js). Applied when a
// logged-in page opens, and taken off again when this layout closes, so the
// landing page is never left with it.
onMounted(() => applyLargeText(auth.user?.large_text))
onUnmounted(() => applyLargeText(false))

// Load requests once here so the active-task count is right on every page
onMounted(store.load)

/*
  Below xl the links sit in a menu that drops down from the toggler. Choosing
  a page used to leave it hanging open over the new page, so it is closed on
  every route change. Watching the route rather than each link covers the nav
  links, the brand and Profile in one place. Only when it is open (.show):
  on wide screens the menu is never collapsed, so this does nothing there.
  Going through Bootstrap keeps the toggler's aria-expanded correct.
*/
const navMenu = ref(null)

function closeMenu() {
  if (navMenu.value?.classList.contains('show')) {
    Collapse.getOrCreateInstance(navMenu.value, { toggle: false }).hide()
  }
}

watch(() => route.fullPath, closeMenu)

async function logout() {
  closeMenu()
  await auth.logout()
  router.push('/landing')
}
</script>

<template>
  <nav class="navbar navbar-expand-xl app-navbar">
    <!--
      Two copies of the same person, one per stride. The CSS shows one and
      hides the other, turn and turn about, which is what makes it a walk
      rather than a slide. Decorative, so hidden from screen readers.
    -->
    <div v-if="showWalker" class="walker-track" aria-hidden="true" data-testid="walker">
      <div class="walker">
        <img :src="avatarPicture" class="walker-frame walker-frame-1" alt="" />
        <img :src="walkerStep" class="walker-frame walker-frame-2" alt="" />
      </div>
    </div>

    <div class="container">
      <!-- add better icon beside kampung spirit ? -->
      <router-link class="navbar-brand" :to="auth.homePath"><BrandMark />Kampung Spirit</router-link>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Open menu">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div ref="navMenu" class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <!-- Ask for help (the old Senior home page) -->
          <li v-if="!auth.isAdmin" class="nav-item">
            <router-link class="nav-link nav-pixel-amber" to="/app/requests" active-class="active">My Requests</router-link>
          </li>
          <!-- Help others (the old Youth home page). exact so it is not lit up on every /app page -->
          <li class="nav-item">
            <router-link class="nav-link nav-pixel-aqua" to="/app" exact-active-class="active">Help Board</router-link>
          </li>
          <li v-if="!auth.isAdmin" class="nav-item">
            <router-link class="nav-link nav-pixel-blue" to="/app/tasks" active-class="active">My Tasks</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link nav-pixel-rose" to="/app/hangouts" active-class="active">Hangouts</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link nav-pixel-green" to="/app/skill-swaps" active-class="active">Skill Swaps</router-link>
          </li>
          <li v-if="!auth.isAdmin" class="nav-item">
            <router-link class="nav-link nav-pixel-violet" to="/app/rewards" active-class="active">Rewards</router-link>
          </li>
        </ul>

        <!-- The name chip. The points counter lives inside the menu it opens. -->
        <ul class="navbar-nav ms-auto align-items-lg-center gap-2 gap-lg-3">
          <li class="nav-item dropdown">
            <a class="nav-link user-toggle dropdown-toggle d-flex align-items-center gap-2" href="#" role="button"
              data-bs-toggle="dropdown" aria-expanded="false">
              <!-- Their own avatar, or the first letter of their name until they build one -->
              <span class="avatar-frame" aria-hidden="true">
                <img v-if="avatarPicture" :src="avatarPicture" class="avatar-portrait" alt="" />
                <span v-else class="avatar-initial">{{ avatarInitial }}</span>
              </span>
              <span class="user-name" data-testid="username">{{ auth.user.name }}</span>
              <span v-if="auth.isAdmin" class="badge admin-badge" data-testid="admin-badge">Admin</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <div class="dropdown-header">
                  <div class="fw-bold">{{ auth.user.name }}</div>
                  <div class="menu-meta">{{ auth.user.block }}</div>
                  <span v-if="!auth.isAdmin" class="points-pill" data-testid="points"><img src="/images/coin.svg"
                    class="point-coin-img" alt="" />{{ points.myPoints }} pts</span>
                </div>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <!-- An admin has no profile page (router/index.js, notForAdmin) -->
              <li v-if="!auth.isAdmin">
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

  <!-- "Get updates on Telegram?" after posting, hosting, joining or accepting -->
  <TelegramPrompt />
</template>