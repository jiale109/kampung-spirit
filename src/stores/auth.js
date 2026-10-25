/*
  ============================================================================
  Authentication store                                   Owner: Reuben Tham
  ============================================================================
  Sign up, log in and the logged-in person's profile, using Supabase Auth.

  auth.user is null when logged out, otherwise the person's row from profiles:
    { id, name, block, interests, large_text, age_group, guardian_status }
  age_group is 'youth' (12-21), 'adult' (22-64) or 'senior' (65+).
  guardian_status is 'not_needed', 'pending' or 'verified' (under 18s need a
  verified guardian before they can accept tasks).

  Every action returns { ok: true } or { ok: false, error: 'Plain message' }.
  The database rules (age limits, guardian details) are in supabase/schema.sql.
  The sign-up form checks the same rules, because Supabase hides the
  database's own error messages during sign up.
*/
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

// Every column the app reads off a profile. A column missing from this list
// arrives as undefined in auth.user, however well it saved, so ADD TO THIS
// LIST whenever a new column is added to public.profiles.
const PROFILE_COLUMNS =
  'id, name, block, interests, large_text, age_group, guardian_status, gender, skin_tone'

export const useAuthStore = defineStore('auth', () => {
  // The logged-in person (or null)
  const user = ref(null)
  // True once we have checked for a saved session (see init)
  const ready = ref(false)

  // TEMPORARY until the senior and youth pages are merged into one set:
  // seniors start on the senior pages, everyone else on the youth pages.
  const homePath = computed(() => (user.value?.age_group === 'senior' ? '/app/requests' : '/app'))

  // Logged out somewhere else (another tab, or the session expired)
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') user.value = null
  })

  async function loadProfile(id) {
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single()
    // Shown in the browser console (F12) to help find the cause
    if (error) console.error('Could not load profile:', error.code, error.message, error.details ?? '', error.hint ?? '')
    user.value = error ? null : data
    return !error
  }

  // Supabase keeps the session in the browser, so a refresh does not log you out.
  // The route guard (router/index.js) calls this before every page.
  async function init() {
    if (ready.value) return
    const { data } = await supabase.auth.getSession()
    if (data.session) await loadProfile(data.session.user.id)
    ready.value = true
  }

  // birthDate is 'YYYY-MM-DD'. guardian is only needed for ages 12-17: { name, email, consent }
  async function register({ email, password, name, block, birthDate, largeText = false, guardian = null }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // These become raw_user_meta_data, which the handle_new_user trigger reads
      options: {
        data: {
          name,
          block,
          birth_date: birthDate,
          large_text: largeText,
          guardian_name: guardian?.name ?? null,
          guardian_email: guardian?.email ?? null,
          guardian_consent: guardian?.consent ?? false,
        },
      },
    })

    if (error) {
      if (error.code === 'user_already_exists') {
        return { ok: false, error: 'An account with this email already exists. Try logging in instead.' }
      }
      if (error.code === 'weak_password') {
        return {
          ok: false,
          error: 'Please choose a stronger password: at least 8 characters, with a capital letter, a small letter, a number and a special character.',
        }
      }
      if (error.code === 'email_address_invalid') {
        return { ok: false, error: 'Please check your email address.' }
      }
      // Most likely the database refused the details (age or guardian rules)
      return { ok: false, error: 'We could not create your account. Please check your details and try again.' }
    }

    // Only happens if "Confirm email" is switched on in Supabase
    if (!data.session) {
      return { ok: false, error: 'Please open the email we sent you to confirm your account, then log in.' }
    }

    await loadProfile(data.user.id)
    return { ok: true }
  }

  async function login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: 'That email or password is not right.' }

    if (!(await loadProfile(data.user.id))) {
      await supabase.auth.signOut()
      return { ok: false, error: 'We could not load your profile. Please try again.' }
    }
    return { ok: true }
  }

  // Change your own profile. The database only grants UPDATE on name, block,
  // interests and large_text (supabase/schema.sql, section 2), so anything
  // else is refused there even if it were sent. Fields left out are not
  // touched. Reloads the profile afterwards so the whole app sees the change.
  async function updateProfile({ name, block, interests, largeText, gender, skinTone }) {
    if (!user.value) return { ok: false, error: 'Please log in again.' }

    const changes = {}
    if (name !== undefined) changes.name = name
    if (block !== undefined) changes.block = block
    if (interests !== undefined) changes.interests = interests
    if (largeText !== undefined) changes.large_text = largeText
    // The avatar: both may be null, which means "not chosen yet"
    if (gender !== undefined) changes.gender = gender
    if (skinTone !== undefined) changes.skin_tone = skinTone

    /*
      .select() matters: without it the database reports success even when the
      row was never touched, because the update matched nothing it was allowed
      to change. .single() then turns that into a real error, so a save that
      quietly did nothing cannot show "Your profile is saved."
    */
    const { error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', user.value.id)
      .select('id')
      .single()

    // Shown in the browser console (F12) to help find the cause
    if (error) {
      console.error('Could not save profile:', error.code, error.message, error.details ?? '', error.hint ?? '')
      return { ok: false, error: 'We could not save your changes. Please try again.' }
    }

    await loadProfile(user.value.id)
    return { ok: true }
  }

  async function logout() {
    user.value = null
    await supabase.auth.signOut()
  }

  return { user, ready, homePath, init, register, login, updateProfile, logout }
})
