import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

import LandingView from '../views/LandingView.vue'

import SeniorViewsLayout from '../layouts/SeniorViewsLayout.vue'
import YouthViewsLayout from '../layouts/YouthViewsLayout.vue'

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

// Shared pages are listed once and added under both /senior and /youth, so each
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

  // Public route: pick Senior or Youth and "log in"
  { path: '/landing', component: LandingView },

  // Senior routes (SeniorViewsLayout as parent)
  {
    path: '/senior',
    component: SeniorViewsLayout,
    meta: { role: 'senior' },
    children: [
      { path: '', component: SeniorHelpBoardView },
      { path: 'create', component: SeniorCreateRequestView },
      { path: 'edit/:requestId', component: SeniorEditRequestView },
      ...sharedChildren,
    ],
  },

  // Youth routes (YouthViewsLayout as parent)
  {
    path: '/youth',
    component: YouthViewsLayout,
    meta: { role: 'youth' },
    children: [
      { path: '', component: YouthHelpBoardView },
      { path: 'tasks', component: YouthMyTasksView },
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
// person is logged in with the right role for the page, and if not, sends
// them back to the landing page. Returning nothing allows the navigation.
router.beforeEach((to) => {
  const auth = useAuthStore()

  // Pages with meta.role (the /senior and /youth pages) need a matching login
  if (to.meta.role && auth.user?.role !== to.meta.role) {
    return '/landing'
  }
})

export default router
