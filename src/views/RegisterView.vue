<script setup>
/*
  Sign up                                                Owner: Reuben Tham
  Anyone 12 or older can join. Ages 12-17 must give a parent or guardian's
  name and email, and tick that the guardian agrees (this acts as the waiver).
  These checks are repeated in the database (supabase/schema.sql), but are
  done here first so the person sees a clear message.

  Passwords: typed twice (both must match) and must pass every rule in
  passwordRules. Supabase checks the same rules again on its side
  (Authentication -> Sign In / Providers -> Email -> password requirements),
  so keep the two in step if you change them.
*/
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import LandingHero from '../components/LandingHero.vue'
import PasswordInput from '../components/PasswordInput.vue'

const router = useRouter()
const auth = useAuthStore()

const MIN_AGE = 12
const ADULT_AGE = 18

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const days = Array.from({ length: 31 }, (_, i) => i + 1)

const form = ref({
  name: '',
  email: '',
  password: '',
  passwordAgain: '',
  block: '',
  day: '',
  month: '',
  year: '',
  largeText: false,
  guardianName: '',
  guardianEmail: '',
  guardianConsent: false,
})
const errors = ref({})
const formError = ref('')
const busy = ref(false)

// The birth date as 'YYYY-MM-DD', or null if the day, month and year do not make a real date
const birthDate = computed(() => {
  const day = Number(form.value.day)
  const month = Number(form.value.month)
  const year = Number(form.value.year)
  if (!day || !month || !/^\d{4}$/.test(form.value.year)) return null

  const date = new Date(year, month - 1, day)
  if (date.getDate() !== day) return null // e.g. 31 February
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})

// Age today, worked out the same way as the database's age()
const age = computed(() => {
  if (!birthDate.value) return null
  const [year, month, day] = birthDate.value.split('-').map(Number)
  const today = new Date()
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  return today.getFullYear() - year - (hadBirthday ? 0 : 1)
})

// Show the guardian section only for ages 12-17
const isMinor = computed(() => age.value !== null && age.value >= MIN_AGE && age.value < ADULT_AGE)

const looksLikeEmail = (text) => /^\S+@\S+\.\S+$/.test(text.trim())

// Every rule must pass. Shown as a checklist under the password box, ticked
// off as the person types, so they can see what is still missing.
const passwordRules = [
  { key: 'length', text: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', text: 'A capital letter (A to Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', text: 'A small letter (a to z)', test: (p) => /[a-z]/.test(p) },
  { key: 'number', text: 'A number (0 to 9)', test: (p) => /[0-9]/.test(p) },
  { key: 'special', text: 'A special character, like ! @ # or $', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
]
const passwordChecks = computed(() =>
  passwordRules.map((rule) => ({ ...rule, met: rule.test(form.value.password) })),
)
const passwordStrong = computed(() => passwordChecks.value.every((c) => c.met))

// Only say whether they match once something has been typed in the second box
const passwordsMatch = computed(() => form.value.password === form.value.passwordAgain)
const showMatch = computed(() => form.value.passwordAgain.length > 0)

function validate() {
  const f = form.value
  const e = {}

  if (f.name.trim().length < 2) e.name = 'Please write your name.'
  if (!looksLikeEmail(f.email)) e.email = 'Please write your email, like name@example.com.'
  if (!passwordStrong.value) e.password = 'Your password does not meet all the rules below yet.'
  if (!f.passwordAgain) e.passwordAgain = 'Please type your password again.'
  else if (!passwordsMatch.value) e.passwordAgain = 'The two passwords are different. Please type them again.'
  if (f.block.trim().length < 3) e.block = 'Please write your block and street, like Blk 412 Eunos Cres.'

  if (!birthDate.value) e.birthDate = 'Please choose your day, month and year of birth.'
  else if (age.value < 0 || age.value > 120) e.birthDate = 'Please check the year of birth.'
  else if (age.value < MIN_AGE) e.birthDate = `You need to be at least ${MIN_AGE} years old to join.`

  if (isMinor.value) {
    if (f.guardianName.trim().length < 2) e.guardianName = "Please write your parent or guardian's name."
    if (!looksLikeEmail(f.guardianEmail)) e.guardianEmail = "Please write your parent or guardian's email."
    else if (f.guardianEmail.trim().toLowerCase() === f.email.trim().toLowerCase()) {
      e.guardianEmail = "Please use your parent or guardian's own email, not yours."
    }
    if (!f.guardianConsent) e.guardianConsent = 'Your parent or guardian needs to agree before you can join.'
  }

  errors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  formError.value = ''
  if (!validate()) return

  const f = form.value
  busy.value = true
  const result = await auth.register({
    email: f.email.trim(),
    password: f.password,
    name: f.name.trim(),
    block: f.block.trim(),
    birthDate: birthDate.value,
    largeText: f.largeText,
    guardian: isMinor.value
      ? { name: f.guardianName.trim(), email: f.guardianEmail.trim(), consent: f.guardianConsent }
      : null,
  })
  busy.value = false

  if (result.ok) router.push(auth.homePath)
  else formError.value = result.error
}
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0 landing-row">

      <!-- Tagline over photos that change by themselves -->
      <LandingHero />

      <!-- Sign up -->
      <div class="col-lg-6 landing-panel">
        <div class="login-box">
          <h2 class="page-title">Create an account</h2>
          <p class="page-subtitle mb-4">Ask for help, help others, or both.</p>

          <div v-if="formError" class="alert alert-danger" role="alert">{{ formError }}</div>

          <form class="d-grid gap-4" novalidate @submit.prevent="submit">
            <div>
              <label for="name" class="form-label">Your name</label>
              <input id="name" v-model="form.name" type="text" class="form-control" autocomplete="name"
                :class="{ 'is-invalid': errors.name }" maxlength="60" />
              <div class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <div>
              <label for="email" class="form-label">Email</label>
              <input id="email" v-model="form.email" type="email" class="form-control" autocomplete="email"
                :class="{ 'is-invalid': errors.email }" />
              <div class="invalid-feedback">{{ errors.email }}</div>
            </div>

            <div>
              <label for="password" class="form-label">Password</label>
              <PasswordInput id="password" v-model="form.password" autocomplete="new-password"
                aria-describedby="password-rules" :invalid="!!errors.password" />
              <div v-if="errors.password" class="invalid-feedback d-block">{{ errors.password }}</div>

              <!-- Ticked off as they type. The words say done / not yet, not only the colour. -->
              <p class="form-text mb-1 mt-2">Your password needs:</p>
              <ul id="password-rules" class="password-rules" data-testid="password-rules">
                <li v-for="c in passwordChecks" :key="c.key" :class="{ 'is-met': c.met }">
                  <span class="rule-mark" aria-hidden="true">{{ c.met ? '✓' : '○' }}</span>
                  {{ c.text }}
                  <span class="visually-hidden">{{ c.met ? '(done)' : '(not yet)' }}</span>
                </li>
              </ul>
            </div>

            <div>
              <label for="password-again" class="form-label">Type your password again</label>
              <PasswordInput id="password-again" v-model="form.passwordAgain" autocomplete="new-password"
                aria-describedby="password-match" :invalid="!!errors.passwordAgain" />
              <div v-if="errors.passwordAgain" class="invalid-feedback d-block">{{ errors.passwordAgain }}</div>
              <p v-else-if="showMatch" id="password-match" class="form-text password-match"
                :class="{ 'is-met': passwordsMatch }" aria-live="polite">
                <span aria-hidden="true">{{ passwordsMatch ? '✓' : '○' }}</span>
                {{ passwordsMatch ? 'The passwords match.' : 'The passwords do not match yet.' }}
              </p>
            </div>

            <div>
              <label for="block" class="form-label">Block and street</label>
              <input id="block" v-model="form.block" type="text" class="form-control" autocomplete="street-address"
                placeholder="e.g. Blk 412 Eunos Cres" :class="{ 'is-invalid': errors.block }" maxlength="80" />
              <div class="invalid-feedback">{{ errors.block }}</div>
            </div>

            <!-- Separate boxes instead of a date picker, which many seniors find hard to use -->
            <fieldset>
              <legend class="form-label">Date of birth</legend>
              <div class="row g-2">
                <div class="col-12 col-sm-4">
                  <label for="birth-day" class="visually-hidden">Day</label>
                  <select id="birth-day" v-model="form.day" class="form-select" :class="{ 'is-invalid': errors.birthDate }">
                    <option value="" disabled>Day</option>
                    <option v-for="d in days" :key="d" :value="String(d)">{{ d }}</option>
                  </select>
                </div>
                <div class="col-12 col-sm-8">
                  <label for="birth-month" class="visually-hidden">Month</label>
                  <select id="birth-month" v-model="form.month" class="form-select" :class="{ 'is-invalid': errors.birthDate }">
                    <option value="" disabled>Month</option>
                    <option v-for="(m, i) in months" :key="m" :value="String(i + 1)">{{ m }}</option>
                  </select>
                </div>
                <div class="col-12">
                  <label for="birth-year" class="visually-hidden">Year</label>
                  <input id="birth-year" v-model="form.year" type="text" inputmode="numeric" maxlength="4"
                    class="form-control" placeholder="Year, e.g. 1955" :class="{ 'is-invalid': errors.birthDate }" />
                </div>
              </div>
              <div v-if="errors.birthDate" class="invalid-feedback d-block" role="alert">{{ errors.birthDate }}</div>
              <div class="form-text">Only you can see your date of birth. Others see your age group.</div>
            </fieldset>

            <!-- Only for ages 12-17 -->
            <fieldset v-if="isMinor" class="guardian-box" data-testid="guardian-section">
              <legend class="form-label">Parent or guardian</legend>
              <p class="mb-3">You are under {{ ADULT_AGE }}, so a parent or guardian must agree before you can help others.
                We will check with them before you accept your first task.</p>

              <div class="d-grid gap-3">
                <div>
                  <label for="guardian-name" class="form-label">Parent or guardian's name</label>
                  <input id="guardian-name" v-model="form.guardianName" type="text" class="form-control"
                    :class="{ 'is-invalid': errors.guardianName }" maxlength="60" />
                  <div class="invalid-feedback">{{ errors.guardianName }}</div>
                </div>
                <div>
                  <label for="guardian-email" class="form-label">Parent or guardian's email</label>
                  <input id="guardian-email" v-model="form.guardianEmail" type="email" class="form-control"
                    :class="{ 'is-invalid': errors.guardianEmail }" />
                  <div class="invalid-feedback">{{ errors.guardianEmail }}</div>
                </div>
                <div class="form-check">
                  <input id="guardian-consent" v-model="form.guardianConsent" type="checkbox" class="form-check-input"
                    :class="{ 'is-invalid': errors.guardianConsent }" />
                  <label for="guardian-consent" class="form-check-label">
                    My parent or guardian has read about Kampung Spirit and agrees that I can join and help neighbours.
                  </label>
                  <div class="invalid-feedback">{{ errors.guardianConsent }}</div>
                </div>
              </div>
            </fieldset>

            <div class="form-check form-switch">
              <input id="large-text" v-model="form.largeText" type="checkbox" role="switch" class="form-check-input" />
              <label for="large-text" class="form-check-label">Use large text</label>
              <div class="form-text">You can change this later in your profile.</div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-100" :disabled="busy">
              {{ busy ? 'Creating your account…' : 'Create account' }}
            </button>
          </form>

          <p class="mt-4 mb-0">Already have an account? <router-link to="/landing">Log in</router-link></p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Same size as the other labels (Bootstrap makes legends large) */
fieldset legend {
  font-size: 1rem;
}

.guardian-box {
  padding: 1.25rem;
  background: var(--ks-surface);
  border: 2px solid var(--ks-line);
  border-radius: 0.75rem;
}

/* Password checklist: a tick and darker words once a rule is met */
.password-rules {
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ks-muted);
}

.password-rules li,
.password-match {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.rule-mark {
  flex: none;
  width: 1.1em;
  text-align: center;
}

.password-rules li.is-met,
.password-match.is-met {
  color: var(--ks-teal-dark);
  font-weight: 600;
}

/* Bootstrap's checkboxes are small; make them easier to tap */
.form-check-input {
  width: 1.4rem;
  height: 1.4rem;
  margin-top: 0.15rem;
}

.form-switch .form-check-input {
  width: 2.6rem;
}

.form-check-label {
  padding-left: 0.4rem;
}
</style>
