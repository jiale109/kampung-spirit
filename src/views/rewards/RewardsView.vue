<script setup>
/*
  ============================================================================
  GUIDE: Kampung Points, Rewards and Community Challenge   Owner: Nathaniel Low
  ============================================================================
  This page is a PLACEHOLDER. Replace the template with the real feature.

  Route:  /senior/rewards and /youth/rewards (same page for both roles, see
          sharedChildren in router/index.js).

  WHAT THE PROPOSAL SAYS
  Every completed task, hangout and skill-swap earns points based on
  difficulty and duration, so harder and longer help earns more. Users redeem
  points for vouchers from local Eunos merchants (hawker, kopitiam,
  supermarket, pharmacy) and keep them in a personal wallet. A monthly
  estate-wide challenge (e.g. 10,000 points) shows a live progress bar, and
  all contributors receive bonus points when the target is reached.
  Vouchers are SIMULATED for this prototype.

  WHAT EXISTS ALREADY
  - lib/points.js has calcPoints(difficulty, duration) for help requests.
  - stores/helpRequest.js holds a `points` map { userId: total } and adds to
    it in confirmDone(). The youth navbar shows the youth's points from there.

  STEP BY STEP (build in this order, each step works on its own)

  1. One place for points (src/stores/points.js, new file)
     Move the points out of helpRequest.js into their own setup store (copy
     the pattern: ref loaded from localStorage, watch() to save, NEW key).
     Keep a ledger so the page can show history:
       ledger = [{ id, userId, amount, reason, createdAt }]
     Actions: awardPoints(userId, amount, reason) and spendPoints(userId, amount, reason).
     balance for a user = sum of their ledger rows.
     Then change helpRequest.js confirmDone() to call awardPoints(), and read
     the balance in layouts/YouthViewsLayout.vue (store.myPoints today).
     The Hangouts and Skill Swaps owners call awardPoints(), so do this FIRST
     and tell them the function name. Add rules for their points in lib/points.js
     (e.g. pointsForHangout, pointsForSkillSwap).

  2. Voucher shop (lib/vouchers.js, new, plus the page)
     A plain array: { id, merchant, type: 'Hawker', title: '$2 off any meal', cost: 50 }.
     Use real types from the proposal: hawker, kopitiam, supermarket, pharmacy.
     Show them as cards (reuse the idea in components/RequestCard.vue).

  3. Redeem and wallet (stores/wallet.js, new)
     redeem(voucherId): fail with a plain message if the user does not have
     enough points; otherwise spendPoints() and add to the wallet:
       { id, voucherId, userId, code: 'KS-4F9Q2', redeemedAt, used: false }
     A wallet section lists the codes. A "Mark as used" button is a nice touch.
     Always confirm before spending (copy the modal in
     views/senior/SeniorHelpBoardView.vue).

  4. Community challenge
     Total points earned by everyone this month = sum of ledger rows (amount > 0)
     in the current month. Show a Bootstrap progress bar towards a target
     (start with 10000 in lib/points.js as COMMUNITY_TARGET). Show the numbers
     as text too ("6,420 of 10,000 points"), not only as a bar.
     Bonus: when the total passes the target, give each contributor a bonus
     ONCE (keep a flag, e.g. bonusPaidForMonth: '2026-10').

  5. Seniors earn points too
     Seniors earn from hangouts and skill swaps. Make sure the page works for a
     user with zero points and an empty wallet (use <EmptyState>).

  6. Tests (e2e/rewards.spec.js, copy the style of e2e/helpboard.spec.js)
     Redeem a voucher, points go down, the code is in the wallet, and
     redeeming with too few points is refused.

  SENIOR-FRIENDLY RULES (also in README.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Senior pages are already 22px text, so check
  your layout at that size.
*/

import { ref, computed } from 'vue'
import { usePointsStore } from '../../stores/points.js'
import { vouchers, voucherTypes } from '../../lib/vouchers.js'
import VoucherCard from '../../components/VoucherCard.vue'
import EmptyState from '../../components/EmptyState.vue'

const pointsStore = usePointsStore()

const searchQuery = ref('')
const selectedType = ref('All')
const activeModalVoucher = ref(null)

// Filter by search text and category pills
const filteredVouchers = computed(() => {
  return vouchers.filter((v) => {
    const matchesCategory = selectedType.value === 'All' || v.type === selectedType.value
    const matchesSearch =
      searchQuery.value.trim() === '' ||
      v.merchant.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      v.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      v.type.toLowerCase().includes(searchQuery.value.toLowerCase())

    return matchesCategory && matchesSearch
  })
})
</script>

<template>
  <div class="rewards-page pb-5">
    <!-- Header with User Balance -->
    <div class="page-header d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h1 class="page-title">Rewards</h1>
        <p class="page-subtitle text-muted">Redeem your kampung points at popular local merchants.</p>
      </div>
      <div>
        <span class="count-pill is-full" data-testid="rewards-balance">
          ⭐ <strong>{{ pointsStore.myPoints }} pts</strong>
        </span>
      </div>
    </div>

    <!-- Bootstrap Search Bar (input-group) -->
    <!-- <div class="input-group input-group-lg mb-4">
      <span class="input-group-text bg-white border-end-0 rounded-start-pill ps-3 text-muted">
        
      </span>
      <input
        v-model="searchQuery"
        type="search"
        class="form-control border-start-0 rounded-end-pill pe-4 shadow-none"
        placeholder="Search merchants, hawkers, or vouchers..."
        aria-label="Search rewards"
      />
    </div> -->

    <!--  Category Filters -->
    <div class="d-flex gap-2 overflow-auto pb-2 mb-4" role="tablist">
      <button
        v-for="t in voucherTypes"
        :key="t.name"
        type="button"
        class="btn rounded-pill px-3 text-nowrap d-inline-flex align-items-center gap-2"
        :class="selectedType === t.name ? 'btn-primary active text-white' : 'btn-outline-secondary bg-white'"
        @click="selectedType = t.name"
      >
        <span>{{ t.icon }}</span>
        <span>{{ t.name }}</span>
      </button>
    </div>

    <!-- Section Title & Counter -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h2 class="h4 fw-bold mb-0">
        {{ selectedType === 'All' ? 'Featured Brands' : selectedType }}
      </h2>
      <span class="text-muted small">{{ filteredVouchers.length }} vouchers available</span>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="filteredVouchers.length === 0"
      message="No matching rewards found. Try a different search."
    />


<div v-else class="row row-cols-1 row-cols-md-2 g-4">
  <div v-for="voucher in filteredVouchers" :key="voucher.id" class="col">
    <VoucherCard
      :voucher="voucher"
      :can-afford="pointsStore.myPoints >= voucher.cost"
      @select="activeModalVoucher = $event"
    />
  </div>
</div>

    <!-- Voucher Details -->
    <div
      v-if="activeModalVoucher"
      class="modal show d-block"
      role="dialog"
      aria-modal="true"
      @click.self="activeModalVoucher = null"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-header border-0 pb-0">
            <h2 class="modal-title h5 fw-bold">{{ activeModalVoucher.merchant }}</h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="activeModalVoucher = null"
            ></button>
          </div>
          <div class="modal-body">
            <div
              class="mb-3 text-center p-3 rounded-3"
              :style="{ backgroundColor: activeModalVoucher.bg }"
            >
              <img
                :src="activeModalVoucher.logo"
                :alt="activeModalVoucher.merchant"
                style="height: 80px; object-fit: contain;"
                @error="$event.target.style.display = 'none'"
              />
            </div>
            <h3 class="h5 fw-bold mb-1">{{ activeModalVoucher.title }}</h3>
            <p class="text-muted small mb-3">📍 {{ activeModalVoucher.branch }}</p>

            <p class="mb-3">{{ activeModalVoucher.description }}</p>

            <div class="alert alert-light border d-flex justify-content-between align-items-center mb-3">
              <span><strong>Cost:</strong> ⭐ {{ activeModalVoucher.cost }} pts</span>
              <span class="text-muted small">
                Your balance: <strong>⭐ {{ pointsStore.myPoints }} pts</strong>
              </span>
            </div>

            <small class="text-muted d-block">
              <strong>Terms:</strong> {{ activeModalVoucher.terms }}
            </small>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button
              type="button"
              class="btn btn-outline-secondary rounded-pill px-4"
              @click="activeModalVoucher = null"
            >
              Close
            </button>
            <button
              type="button"
              class="btn btn-primary rounded-pill px-4"
              :disabled="pointsStore.myPoints < activeModalVoucher.cost"
            >
              {{
                pointsStore.myPoints >= activeModalVoucher.cost
                  ? `Redeem for ${activeModalVoucher.cost} pts`
                  : `Need ${activeModalVoucher.cost - pointsStore.myPoints} more pts`
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="activeModalVoucher" class="modal-backdrop show"></div>
  </div>
</template>