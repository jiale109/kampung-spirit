<script setup>
/*
  A password box with an eye button at its end that shows or hides what was
  typed. Use it like an <input>: v-model, id, autocomplete and aria-* work as
  usual. Each box remembers its own show/hide state.

    <PasswordInput id="password" v-model="form.password" autocomplete="new-password" :invalid="!!errors.password" />

  The eye means "show the password"; the eye with a line through it means
  "hide it again". The button's label says the same in words for screen readers.
*/
import { ref } from 'vue'

// id, autocomplete, aria-describedby etc. go on the <input>, not the wrapper
defineOptions({ inheritAttrs: false })

const model = defineModel({ type: String, default: '' })

defineProps({
  id: { type: String, required: true },
  invalid: { type: Boolean, default: false },
})

const visible = ref(false)
</script>

<template>
  <div class="password-field">
    <input :id="id" v-model="model" :type="visible ? 'text' : 'password'" class="form-control"
      :class="{ 'is-invalid': invalid }" autocapitalize="off" spellcheck="false" v-bind="$attrs" />

    <button type="button" class="password-toggle" :aria-controls="id" :aria-pressed="visible"
      :aria-label="visible ? 'Hide password' : 'Show password'" @click="visible = !visible">
      <!-- Hidden: an eye ("show it") -->
      <svg v-if="!visible" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <!-- Shown: an eye with a line through it ("hide it") -->
      <svg v-else viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        <line x1="3" y1="3" x2="21" y2="21" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
}

/* Room for the button, and no Bootstrap error icon underneath it */
.password-field .form-control {
  padding-right: 3.5rem;
  background-image: none;
}

/* Edge and IE add their own eye; we already have one */
.password-field .form-control::-ms-reveal,
.password-field .form-control::-ms-clear {
  display: none;
}

.password-toggle {
  position: absolute;
  top: 0;
  right: 0.25rem;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  min-height: 48px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 0.6rem;
  color: var(--ks-muted);
}

.password-toggle:hover {
  color: var(--ks-ink);
}

.password-toggle:focus-visible {
  outline: 3px solid var(--ks-teal);
  outline-offset: -4px;
}

.password-toggle svg {
  width: 1.4rem;
  height: 1.4rem;
}
</style>
