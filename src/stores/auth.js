/*
  ============================================================================
  GUIDE: Authentication store                            Owner: Reuben Tham
  ============================================================================
  Today: login(userId) just picks a demo user from lib/seed.js and keeps it in
  localStorage. Plan for the real version (Express + MongoDB):

  - Keep the SAME names the rest of the app uses: auth.user (null when logged
    out; { id, name, role, block } when logged in), auth.login(), auth.logout().
    Pages and the route guard (router/index.js) only use these, so nothing else
    needs to change.
  - Add register({ name, email, password, role, block }) and make login() take
    { email, password }. Return { ok: true } or { ok: false, error: '...' }, like
    acceptRequest() in stores/helpRequest.js, so pages can show the error.
  - Backend: POST /auth/register, POST /auth/login (return a JWT and the user),
    GET /auth/me (check the token). Send the token with axios on every request.
  - Add an init() that calls GET /auth/me on page load, and call it from
    router.beforeEach (the exemplar project does the same with auth.init()).
  - Store the role on the user in the database. The guard already checks
    to.meta.role, and the server must ALSO check the role on each route, because
    the browser can be changed by the user.
  - Never store passwords yourself: hash them on the server (bcrypt).
*/
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { users } from '../lib/seed.js'

const STORAGE_KEY = 'kampung-user'

export const useAuthStore = defineStore('auth', () => {
  // The logged-in person (or null). Kept in the browser so a refresh does not log you out.
  const user = ref(JSON.parse(localStorage.getItem(STORAGE_KEY)))

  // Demo login: no password, just pick who you are on the landing page.
  function login(userId) {
    user.value = users.find((u) => u.id === userId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
  }

  function logout() {
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { user, login, logout }
})
