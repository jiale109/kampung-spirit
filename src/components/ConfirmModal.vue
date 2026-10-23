<script setup>
import { ref, onMounted, onUnmounted, useId } from 'vue'

// Show it with v-if; it closes when the page stops showing it
defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: 'Yes' },
  cancelLabel: { type: String, default: 'No' },
  // Red main button for actions that undo something (cancel, withdraw)
  danger: { type: Boolean, default: false },
  // data-testid of the main button, so the tests can click it
  testid: { type: String, default: 'confirm-modal' },
})

const emit = defineEmits(['confirm', 'cancel'])

const titleId = useId()
const confirmButton = ref(null)

// Escape closes the modal, like clicking "No"
function onKeydown(event) {
  if (event.key === 'Escape') emit('cancel')
}

// Move focus into the modal, and give it back to where it was when the modal closes
let previousFocus = null
onMounted(() => {
  previousFocus = document.activeElement
  confirmButton.value.focus()
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  previousFocus?.focus?.()
})
</script>

<template>
  <div>
    <div class="modal show" style="display: block;" role="dialog" aria-modal="true"
      :aria-labelledby="titleId" @click.self="emit('cancel')">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            <button type="button" class="btn-close" aria-label="Close" @click="emit('cancel')"></button>
          </div>
          <div class="modal-body">
            {{ message }}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button ref="confirmButton" type="button" class="btn" :class="danger ? 'btn-danger' : 'btn-primary'"
              :data-testid="testid" @click="emit('confirm')">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  </div>
</template>
