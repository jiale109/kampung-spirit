import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.js'
import { COMMUNITY_TARGET, COMMUNITY_BONUS } from '../lib/points.js'

// Points live only in Supabase (points_ledger). Earning, spending (redeem_voucher)
// and the community bonus are all done by database functions.
export const usePointsStore = defineStore('points', () => {
  const auth = useAuthStore()

  // Points used to be kept in the browser. Remove that old copy once.
  try {
    localStorage.removeItem('kampung-points')
  } catch {
    // Storage can be blocked (e.g. private mode); there is nothing to remove then
  }

  const dbLedger = ref([]) // the logged-in person's rows from points_ledger
  const communityTotal = ref(0) // estate-wide total from the community_points_this_month() RPC

  // The load that is running right now, or null when none is
  let loadPromise = null

  // Load real points from Supabase. The help request store calls this every time
  // requests load, so if a load is already running, share it instead of fetching twice.
  function load() {
    if (!loadPromise) loadPromise = fetchPoints().finally(() => { loadPromise = null })
    return loadPromise
  }

  async function fetchPoints() {
    // 1. Load user's personal points
    const userId = auth.user?.id
    if (userId) {
      const { data, error } = await supabase
        .from('points_ledger')
        .select('id, user_id, amount, reason, is_bonus, created_at')
        .order('created_at', { ascending: false })

      // Skip the result if someone else logged in (or out) while it was loading
      if (!error && data && auth.user?.id === userId) {
        dbLedger.value = data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          amount: row.amount,
          reason: row.reason,
          isBonus: row.is_bonus,
          createdAt: new Date(row.created_at).getTime(),
        }))
      }
    }

    // 2. Load estate-wide community total via security definer RPC
    const { data: total, error: totalErr } = await supabase.rpc('community_points_this_month')
    if (!totalErr && total !== null) {
      communityTotal.value = Number(total)
    }
  }

  // Automatically fetch points from Supabase whenever user logs in or out
  watch(
    () => auth.user?.id,
    async (newId) => {
      if (!newId) dbLedger.value = []
      // A load started before the login would not fetch this person's rows, so
      // wait for it to finish and then start a fresh one
      if (loadPromise) await loadPromise.catch(() => {})
      load()
    },
    { immediate: true },
  )

  // 3. User Balance. RLS only returns your own rows, so this works for the
  // logged-in person only; anyone else gets 0.
  const myPoints = computed(() => dbLedger.value.reduce((sum, entry) => sum + entry.amount, 0))

  function getBalance(userId) {
    return userId && userId === auth.user?.id ? myPoints.value : 0
  }

  const myLedger = computed(() => (auth.user?.id ? dbLedger.value : []))

  // 4. Community Challenge Metrics
  // Sum of all points earned by everyone this month, not counting bonuses (from supabase)
  const communityPointsThisMonth = computed(() => communityTotal.value)

  // Progress percentage (0 to 100)
  const communityProgress = computed(() => {
    return Math.min(100, Math.round((communityPointsThisMonth.value / COMMUNITY_TARGET) * 100))
  })

  const isCommunityTargetReached = computed(() => {
    return communityPointsThisMonth.value >= COMMUNITY_TARGET
  })

  return {
    myPoints,
    myLedger,
    COMMUNITY_TARGET,
    COMMUNITY_BONUS,
    communityPointsThisMonth,
    communityProgress,
    isCommunityTargetReached,
    getBalance,
    load,
  }
})
