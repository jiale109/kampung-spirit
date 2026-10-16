import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { usePointsStore } from './points.js'
import { vouchers } from '../lib/vouchers.js'

const STORAGE_KEY = 'kampung-wallet'

export const useWalletStore = defineStore('wallet', () => {
  const auth = useAuthStore()
  const pointsStore = usePointsStore()

  // 1. Load from localStorage or start with empty wallet
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const items = ref(saved ? saved.items : [])

  // 2. Persist to localStorage whenever wallet changes
  watch(
    items,
    () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: items.value }))
    },
    { deep: true },
  )

  // 3. Current logged-in user's wallet items (enriched with voucher details)
  const myWallet = computed(() => {
    if (!auth.user?.id) return []
    return items.value
      .filter((item) => item.userId === auth.user.id)
      .map((item) => {
        const voucher = vouchers.find((v) => v.id === item.voucherId) || {}
        return {
          ...item,
          voucher,
        }
      })
  })

  // 4. Count of unused / ready-to-use vouchers
  const unusedCount = computed(() => {
    return myWallet.value.filter((item) => !item.used).length
  })

  // function to generate voucher codes '
  function generateVoucherCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let randomPart = ''
    for (let i = 0; i < 5; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `KS-${randomPart}`
  }

  // 5. Redeem action
  function redeem(voucherId) {
    if (!auth.user) {
      return { ok: false, error: 'Please log in to redeem vouchers.' }
    }

    const voucher = vouchers.find((v) => v.id === voucherId)
    if (!voucher) {
      return { ok: false, error: 'Sorry, this voucher could not be found.' }
    }

    const userBalance = pointsStore.getBalance(auth.user.id)
    if (userBalance < voucher.cost) {
      return {
        ok: false,
        error: `You need ${voucher.cost} points, but you only have ${userBalance} points.`,
      }
    }

    // Deduct points from pointsStore
    const spendResult = pointsStore.spendPoints(
      auth.user.id,
      voucher.cost,
      `Redeemed voucher: ${voucher.title} (${voucher.merchant})`,
    )

    if (!spendResult.ok) {
      return { ok: false, error: spendResult.error }
    }

    // Add new item to wallet
    const newRecord = {
      id: 'w' + Date.now() + Math.random().toString(36).substring(2, 6),
      voucherId: voucher.id,
      userId: auth.user.id,
      code: generateVoucherCode(),
      redeemedAt: Date.now(),
      used: false,
      usedAt: null,
    }

    items.value.unshift(newRecord)
    return { ok: true, item: newRecord }
  }

  // 6. Mark as used action
  function markAsUsed(id) {
    const item = items.value.find((i) => i.id === id)
    if (item) {
      item.used = true
      item.usedAt = Date.now()
      return { ok: true }
    }
    return { ok: false, error: 'Voucher not found in wallet.' }
  }

  // 7. Reset wallet (for tests and demos)
  function reset() {
    items.value = []
  }

  return {
    items,
    myWallet,
    unusedCount,
    redeem,
    markAsUsed,
    reset,
  }
})