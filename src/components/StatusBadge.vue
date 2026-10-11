<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
})

// Short, plain words. The colour is only a helper: the text always says the status.
const statuses = {
  open: { text: 'Open', className: 'status-open' },
  accepted: { text: 'Accepted', className: 'status-accepted' },
  pending_confirmation: { text: 'Awaiting confirmation', className: 'status-pending' },
  completed: { text: 'Completed', className: 'status-completed' },
  cancelled: { text: 'Cancelled', className: 'status-cancelled' },
}

const info = computed(() => statuses[props.status])
</script>

<template>
  <span class="status-pill" :class="info.className">{{ info.text }}</span>
</template>
