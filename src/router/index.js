import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

import LandingView from '../views/LandingView.vue'
import RegisterView from '../views/RegisterView.vue'

import MainLayout from '../layouts/MainLayout.vue'

import SeniorHelpBoardView from '../views/senior/SeniorHelpBoardView.vue'
import SeniorCreateRequestView from '../views/senior/SeniorCreateRequestView.vue'
import SeniorEditRequestView from '../views/senior/SeniorEditRequestView.vue'

import YouthHelpBoardView from '../views/youth/YouthHelpBoardView.vue'
import YouthMyTasksView from '../views/youth/YouthMyTasksView.vue'

// Pages both roles can open. Each feature has its own folder under views/
// so teammates can work on them without touching each other's files.
import HangoutsView from '../views/hangouts/HangoutsView.vue'
import SkillSwapView from '../views/skillswap/SkillSwapView.vue'
import RewardsView from '../views/rewards/RewardsView.vue'
import ProfileView from '../views/profile/ProfileView.vue'

// Shared pages are listed once and added under both /senior and /app, so each
// role sees them inside its own layout (navbar). Add new shared pages here.
const sharedChildren = [
  { path: 'hangouts', component: HangoutsView },
  { path: 'skill-swaps', component: SkillSwapView },
  { path: 'rewards', component: RewardsView },
  { path: 'profile', component: ProfileView },
]

const routes = [
  // Root redirect
  { path: '/', redirect: '/landing' },

  // Public routes: log in, and sign up
  { path: '/landing', component: LandingView, meta: { guestOnly: true } },
  { path: '/register', component: RegisterView, meta: { guestOnly: true } },

   {
     path: '/app',
     component: MainLayout,
     meta: { requiresAuth: true },
     children: [
       { path: '', component: YouthHelpBoardView },
       { path: 'tasks', component: YouthMyTasksView },
       { path: 'requests', component: SeniorHelpBoardView },
       { path: 'requests/create', component: SeniorCreateRequestView },
       { path: 'requests/edit/:requestId', component: SeniorEditRequestView },
       ...sharedChildren,
     ],
   },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Every new page starts at the top (otherwise it opens part-way down on phones)
  scrollBehavior() {
    return { top: 0 }
  },
})

// router.beforeEach runs before every route change. Here it checks that the
// person is logged in, and if not, sends them back to the landing page.
// Anyone can ask for help and anyone can help, so there is no role check.
// Returning nothing allows the navigation.
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // On the first page load, wait until we know whether there is a saved session
  await auth.init()

  // Pages with meta.requiresAuth (the /senior and /app pages) need a login
  if (to.meta.requiresAuth && !auth.user) {
    return '/landing'
  }

  // Already logged in: skip the login and sign-up pages
  if (to.meta.guestOnly && auth.user) {
    return auth.homePath
  }
})

export default router
