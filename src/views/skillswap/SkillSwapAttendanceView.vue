<script setup>
/*
  Route: /app/skill-swaps/:id/attendance (from "Mark as completed" on the
  host's card in SkillSwapView.vue).

  The host ticks who actually came, then confirms. Only the people ticked
  (and the host) earn points: complete_skill_session(swap_id, attended_ids)
  in supabase/schema.sql section 8.4 checks the same rules again.

  Everyone starts unticked, so nobody is paid just for signing up.
*/
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'
import { useSkillSwapStore } from '../../stores/skillSwap.js'
import { pointsForSkillSwap } from '../../lib/points.js'
import { formatDate, formatTime, formatDuration } from '../../lib/skillSwapFormat.js'

const route = useRoute()
const router = useRouter()
const store = useSkillSwapStore()

// /app/skill-swaps/<id>/attendance -> /app/skill-swaps
const listPath = computed(() => route.path.replace(/\/[^/]+\/attendance\/?$/, ''))

const loaded = ref(false)
const session = computed(() => store.find(route.params.id) ?? null)
const points = computed(() => (session.value ? pointsForSkillSwap(session.value.duration) : 0))
const people = computed(() => session.value?.attendees ?? [])

// Why this page cannot be used, in plain words, or '' when it can
const blockedMessage = computed(() => {
  const s = session.value
  if (!s) return 'We could not find that session.'
  if (!store.isHost(s)) return 'Only the host can say who came to this session.'
  if (s.status !== 'open') return 'This session is already finished or cancelled, so there is nothing to confirm.'
  if (!store.hasStarted(s)) return 'You can say who came once the session has started.'
  if (people.value.length === 0) return 'Nobody joined this session, so there are no points to give.'
  return ''
})

// The ids ticked so far. Nobody is ticked to begin with.
const ticked = ref([])
const tickedCount = computed(() => ticked.value.length)
const countText = computed(() => `${tickedCount.value} of ${people.value.length} came`)

function selectAll() {
  ticked.value = people.value.map((p) => p.id)
  error.value = ''
}

const confirmMessage = computed(() => {
  const n = tickedCount.value
  return n === 1
    ? `1 person will get ${points.value} points. This cannot be undone.`
    : `${n} people will each get ${points.value} points. This cannot be undone.`
})

const error = ref('')
const errorAlert = ref(null)
const busy = ref(false)
const asking = ref(false)

async function showError(text) {
  error.value = text
  await nextTick()
  errorAlert.value?.focus()
}

function onConfirmPressed() {
  if (busy.value) return
  error.value = ''
  if (tickedCount.value === 0) {
    showError('Please tick at least one person who came.')
    return
  }
  asking.value = true
}

async function save() {
  asking.value = false
  if (busy.value) return
  busy.value = true
  const result = await store.completeSession(session.value.id, ticked.value)
  busy.value = false
  if (!result.ok) {
    showError(result.error)
    return
  }
  router.push({ path: listPath.value, query: { completed: String(result.count), points: String(result.points) } })
}

onMounted(async () => {
  await store.load()
  loaded.value = true
})
</script>

<template>
  <div class="form-page">
    <EmptyState v-if="!loaded" message="Loading the session…" />

    <div v-else-if="store.loadError" class="alert alert-danger d-flex flex-wrap align-items-center gap-3" role="alert">
      <span>{{ store.loadError }}</span>
      <button type="button" class="btn btn-outline-secondary" @click="store.load()">Try again</button>
    </div>

    <EmptyState v-else-if="blockedMessage" :message="blockedMessage">
      <RouterLink :to="listPath" class="btn btn-primary btn-lg" data-testid="back-to-swaps">Back to Skill Swaps</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="page-header">
        <div>
          <h1 class="page-title">Who came to {{ session.title }}?</h1>
          <p class="page-subtitle" data-testid="attendance-when">
            {{ formatDate(session.date) }} · {{ formatTime(session.time) }} · {{ formatDuration(session.duration) }}
          </p>
        </div>
        <RouterLink :to="listPath" class="btn btn-outline-secondary">Back to Skill Swaps</RouterLink>
      </div>

      <p class="attendance-help">
        Tick everyone who came. Only the people you tick earn points, and you do too for hosting.
      </p>

      <div v-if="error" ref="errorAlert" class="alert alert-danger" role="alert" tabindex="-1"
        data-testid="attendance-error">{{ error }}</div>

      <fieldset class="attendance-group">
        <legend class="form-label">People who signed up</legend>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <span class="count-pill" role="status" data-testid="attendance-count">{{ countText }}</span>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="selectAll">
            Select all
          </button>
        </div>

        <ul class="attendee-list">
          <li v-for="p in people" :key="p.id">
            <label class="attendee-row" :class="{ 'is-ticked': ticked.includes(p.id) }" data-testid="attendee-row">
              <input v-model="ticked" type="checkbox" class="form-check-input" :value="p.id" :disabled="busy"
                @change="error = ''" />
              <span class="attendee-name">{{ p.name || 'A neighbour' }}</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div class="d-flex flex-wrap gap-3 mt-4">
        <button type="button" class="btn btn-primary btn-lg" :disabled="busy" data-testid="confirm-attendance-open"
          @click="onConfirmPressed">
          {{ busy ? 'Saving…' : 'Confirm and give points' }}
        </button>
        <RouterLink :to="listPath" class="btn btn-outline-secondary btn-lg">Cancel</RouterLink>
      </div>

      <ConfirmModal v-if="asking" title="Give points?" :message="confirmMessage"
        :confirm-label="busy ? 'Saving…' : 'Yes, give points'" cancel-label="Go back" testid="confirm-attendance"
        @confirm="save" @cancel="asking = false" />
    </template>
  </div>
</template>

<style scoped>
.attendance-help {
  font-size: 1rem;
  margin-bottom: 1.5rem;
}

.attendance-group {
  border: 0;
  padding: 0;
  margin: 0;
}

.attendee-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

/* The whole row is the label, so a tap anywhere on it ticks the box.
   Same sizes as the physical-effort checkbox in RequestForm.vue. */
.attendee-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--bs-border-color);
  border-radius: 0.75rem;
  background: var(--bs-body-bg);
  cursor: pointer;
}

.attendee-row.is-ticked {
  border-color: var(--ks-teal-dark);
}

.attendee-row:focus-within {
  outline: 3px solid var(--ks-teal-dark);
  outline-offset: 2px;
}

.attendee-row .form-check-input {
  width: 1.4rem;
  height: 1.4rem;
  margin: 0;
  flex-shrink: 0;
}

.attendee-name {
  font-size: 1rem;
  font-weight: 600;
}

.alert[tabindex='-1']:focus {
  outline: 3px solid var(--ks-teal-dark);
  outline-offset: 3px;
}
</style>
