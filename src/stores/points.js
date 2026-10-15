import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { seedLedger } from '../lib/seed.js'

const STORAGE_KEY = 'kampung-points'

export const usePointsStore = defineStore('points', () => {
  const auth = useAuthStore()

  // 1. Load ledger from localStorage or fallback to sample seed data
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const ledger = ref(saved ? saved.ledger : seedLedger())

  // 2. Persist to localStorage whenever ledger changes
  watch(
    ledger,
    () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ledger: ledger.value }))
    },
    { deep: true },
  )

  // 3. Calculate balance for any user (sum of all their ledger entries)
  function getBalance(userId) {
    if (!userId) return 0
    return ledger.value
      .filter((entry) => entry.userId === userId)
      .reduce((sum, entry) => sum + entry.amount, 0)
  }

  // 4. Points for the currently logged-in user
  const myPoints = computed(() => getBalance(auth.user?.id))

  // 5. Transaction history for the currently logged-in user (newest first)
  const myLedger = computed(() => {
    if (!auth.user?.id) return []
    return ledger.value.filter((entry) => entry.userId === auth.user.id)
  })

  // 6. Award points action (positive amount)
  function awardPoints(userId, amount, reason = 'Points awarded') {
    const entry = {
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
      userId,
      amount: Math.abs(Number(amount)),
      reason,
      createdAt: Date.now(),
    }
    ledger.value.unshift(entry)
    return entry
  }

  // 7. Spend points action (negative amount)
  function spendPoints(userId, amount, reason = 'Points spent') {
    const num = Math.abs(Number(amount))
    if (getBalance(userId) < num) {
      return { ok: false, error: 'Not enough points' }
    }
    const entry = {
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
      userId,
      amount: -num,
      reason,
      createdAt: Date.now(),
    }
    ledger.value.unshift(entry)
    return { ok: true, entry }
  }

  // 8. Reset to sample seed data (for testing and demo resets)
  function reset() {
    ledger.value = seedLedger()
  }

  return {
    ledger,
    myPoints,
    myLedger,
    getBalance,
    awardPoints,
    spendPoints,
    reset,
  }
})