import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { vouchers } from '../lib/vouchers.js'

// One wallet_items row, in the shape the Rewards page uses
function fromRow(r) {
  return {
    id: r.id,
    voucherId: r.voucher_id,
    code: r.code,
    redeemedAt: new Date(r.redeemed_at).getTime(),
    used: !!r.used_at,
    usedAt: r.used_at ? new Date(r.used_at).getTime() : null,
  }
}

// The wallet lives in Supabase (wallet_items). Redeeming and marking as used go
// through the redeem_voucher() and mark_voucher_used() database functions.
export const useWalletStore = defineStore('wallet', () => {
  const auth = useAuthStore()

  // The wallet used to be kept in the browser. Remove that old copy once.
  try {
    localStorage.removeItem('kampung-wallet')
  } catch {
    // Storage can be blocked (e.g. private mode); there is nothing to remove then
  }

  const items = ref([])

  // RLS only returns your own vouchers, newest first
  async function load() {
    const userId = auth.user?.id
    if (!userId) {
      items.value = []
      return
    }
    const { data, error } = await supabase
      .from('wallet_items')
      .select('id, voucher_id, code, redeemed_at, used_at')
      .order('redeemed_at', { ascending: false })
    // Skip the result if someone else logged in (or out) while it was loading
    if (!error && auth.user?.id === userId) items.value = data.map(fromRow)
  }

  // Load the wallet when someone logs in, and clear it when they log out
  watch(
    () => auth.user?.id,
    (id) => {
      if (!id) items.value = []
      else load()
    },
    { immediate: true },
  )

  // 3. Current logged-in user's wallet items (enriched with voucher details)
  const myWallet = computed(() => {
    if (!auth.user?.id) return []
    return items.value.map((item) => ({
      ...item,
      voucher: vouchers.find((v) => v.id === item.voucherId) || {},
    }))
  })

  // 4. Count of unused / ready-to-use vouchers
  const unusedCount = computed(() => {
    return myWallet.value.filter((item) => !item.used).length
  })

  // 5. Redeem action. The database checks the balance, takes the points and adds
  // the voucher in one step; its error messages are already plain sentences.
  async function redeem(voucherId) {
    if (!auth.user) {
      return { ok: false, error: 'Please log in to redeem vouchers.' }
    }
    const { data, error } = await supabase.rpc('redeem_voucher', { voucher_id: voucherId })
    if (error) return { ok: false, error: error.message }

    await Promise.all([load(), usePointsStore().load()])
    return { ok: true, item: fromRow(data) }
  }

  // 6. Mark as used action
  async function markAsUsed(id) {
    const { error } = await supabase.rpc('mark_voucher_used', { item_id: id })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }

  return {
    items,
    myWallet,
    unusedCount,
    load,
    redeem,
    markAsUsed,
  }
})
