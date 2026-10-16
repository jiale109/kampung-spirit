import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { seedLedger } from '../lib/seed.js'
import { COMMUNITY_TARGET, COMMUNITY_BONUS } from '../lib/points.js'

const STORAGE_KEY = 'kampung-points'

export const usePointsStore = defineStore('points', () => {
  const auth = useAuthStore()

  // 1. Load from localStorage or seed
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const ledger = ref(saved ? saved.ledger : seedLedger())
  // Flag to ensure the bonus is paid only once per calendar month (e.g. '2026-10')
  const bonusPaidForMonth = ref(saved ? saved.bonusPaidForMonth : null)

  // 2. Persist to localStorage
  watch(
    [ledger, bonusPaidForMonth],
    () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ledger: ledger.value,
          bonusPaidForMonth: bonusPaidForMonth.value,
        }),
      )
    },
    { deep: true },
  )

  // Helper: check if a timestamp occurred in the current month
  function isCurrentMonth(timestamp) {
    if (!timestamp) return false
    const d = new Date(timestamp)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }

  // Current year-month key, e.g. '2026-10'
  const currentMonthKey = computed(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  // 3. User Balance
  function getBalance(userId) {
    if (!userId) return 0
    return ledger.value
      .filter((entry) => entry.userId === userId)
      .reduce((sum, entry) => sum + entry.amount, 0)
  }

  const myPoints = computed(() => getBalance(auth.user?.id))

  const myLedger = computed(() => {
    if (!auth.user?.id) return []
    return ledger.value.filter((entry) => entry.userId === auth.user.id)
  })

  // 4. Community Challenge Metrics
  // Sum of all points earned by everyone this month (amount > 0)
  const communityPointsThisMonth = computed(() => {
    return ledger.value
      .filter((entry) => entry.amount > 0 && isCurrentMonth(entry.createdAt))
      .reduce((sum, entry) => sum + entry.amount, 0)
  })

  // Progress percentage (0 to 100)
  const communityProgress = computed(() => {
    return Math.min(100, Math.round((communityPointsThisMonth.value / COMMUNITY_TARGET) * 100))
  })

  const isCommunityTargetReached = computed(() => {
    return communityPointsThisMonth.value >= COMMUNITY_TARGET
  })

  // 5. Bonus Rule: When target is met, give each contributor a bonus ONCE
  function checkCommunityBonus() {
    const monthKey = currentMonthKey.value
    if (communityPointsThisMonth.value >= COMMUNITY_TARGET && bonusPaidForMonth.value !== monthKey) {
      bonusPaidForMonth.value = monthKey

      // Unique contributors who earned points this month (excluding bonuses)
      const contributors = [
        ...new Set(
          ledger.value
            .filter((entry) => entry.amount > 0 && isCurrentMonth(entry.createdAt) && !entry.isBonus)
            .map((entry) => entry.userId),
        ),
      ]

      // Award bonus points to each contributor
      contributors.forEach((userId) => {
        ledger.value.unshift({
          id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
          userId,
          amount: COMMUNITY_BONUS,
          reason: `🎉 Community Challenge Bonus (${monthKey})`,
          isBonus: true,
          createdAt: Date.now(),
        })
      })
    }
  }

  // 6. Award Points action
  function awardPoints(userId, amount, reason = 'Points awarded') {
    const entry = {
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
      userId,
      amount: Math.abs(Number(amount)),
      reason,
      createdAt: Date.now(),
    }
    ledger.value.unshift(entry)

    // Check if this award pushed the community past the 10,000 threshold
    checkCommunityBonus()
    return entry
  }

  // 7. Spend Points action
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

  // 8. Reset
  function reset() {
    ledger.value = seedLedger()
    bonusPaidForMonth.value = null
  }

  return {
    ledger,
    myPoints,
    myLedger,
    COMMUNITY_TARGET,
    COMMUNITY_BONUS,
    communityPointsThisMonth,
    communityProgress,
    isCommunityTargetReached,
    bonusPaidForMonth,
    getBalance,
    awardPoints,
    spendPoints,
    reset,
  }
})