<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  // Who is looking: 'requester' (the senior), 'helper' (the youth), or '' for the neutral words
  viewer: { type: String, default: '' },
})

// Short, plain words. The colour is only a helper: the text always says the status.
const statuses = {
  open: { text: 'Open', className: 'status-open' },
  accepted: { text: 'Accepted', className: 'status-accepted' },
  pending_confirmation: { text: 'Awaiting confirmation', className: 'status-pending' },
  completed: { text: 'Completed', className: 'status-completed' },
  cancelled: { text: 'Cancelled', className: 'status-cancelled' },
}

// The same status in words that fit the person reading it
const wordsFor = {
  requester: {
    open: 'Waiting for a helper',
    accepted: 'Helper found',
    pending_confirmation: "Please check: helper says it's done",
    completed: 'Done',
    cancelled: 'Cancelled',
  },
  helper: {
    open: 'Open',
    accepted: "You're helping",
    pending_confirmation: 'Waiting for the senior to confirm',
    completed: 'Done, points earned',
    cancelled: 'Cancelled by the senior',
  },
}

const info = computed(() => statuses[props.status])
const text = computed(() => wordsFor[props.viewer]?.[props.status] ?? info.value.text)
</script>

<template>
  <span class="status-pill" :class="info.className">{{ text }}</span>
</template>
