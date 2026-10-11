<script setup>
defineProps({
  message: { type: String, default: 'Nothing here yet.' },
})
</script>

<template>
  <div class="empty-state">
    <p class="empty-state-message">{{ message }}</p>
    <slot />
  </div>
</template>
