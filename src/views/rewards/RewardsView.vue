<script setup>
/*
  ============================================================================
  GUIDE: Kampung Points, Rewards and Community Challenge   Owner: Nathaniel Low
  ============================================================================
  STATUS: built. Points earned come from Supabase; spending, the wallet and
  the challenge bonus are still saved only in the browser (localStorage).

  Route: /app/rewards (in sharedChildren in router/index.js).

  WHAT THE PROPOSAL SAYS
  Every completed task, hangout and skill-swap earns points based on
  difficulty and duration. Users redeem points for vouchers from local Eunos
  merchants (hawker, kopitiam, supermarket, pharmacy) and keep them in a
  personal wallet. A monthly estate-wide challenge (e.g. 10,000 points) shows
  a live progress bar, and all contributors receive bonus points when the
  target is reached. Vouchers are SIMULATED for this prototype.

  HOW IT WORKS TODAY
  - stores/points.js
      dbLedger   rows from points_ledger in Supabase (loaded on login). These
                 are added by database functions, e.g. confirm_help_done.
      ledger     browser-only rows: voucher spending, challenge bonuses and the
                 sample rows from seedLedger() in lib/seed.js.
      myPoints, myLedger, getBalance(), communityPointsThisMonth,
      communityProgress, isCommunityTargetReached, awardPoints(), spendPoints()
  - stores/wallet.js   redeem(voucherId), markAsUsed(id), myWallet, unusedCount
                       (localStorage key 'kampung-wallet')
  - lib/vouchers.js    voucher catalogue and the type filter pills
  - lib/points.js      COMMUNITY_TARGET, COMMUNITY_BONUS and the points rules
  - components/VoucherCard.vue   one voucher in the shop

  WHAT IS LEFT TO DO
  1. Community total. RLS on points_ledger only lets each person read their
     own rows, so the "estate-wide" total is really "my points + the sample
     rows". Add a database function (security definer) that returns the sum
     of positive amounts this month, call it with supabase.rpc(), and stop
     counting the seedLedger() rows.
  2. Spending and wallet in Supabase. Today points spent and vouchers live in
     one browser only: another device shows the old balance and no vouchers.
     Add a wallet table and a redeem_voucher(voucher_id) function that checks
     the balance and inserts a negative points_ledger row in one step
     (the browser cannot write to points_ledger itself).
  3. Challenge bonus. checkCommunityBonus() runs in the browser, so each
     browser decides on its own. Move it into the database too, with a
     "paid for this month" record, so it is paid exactly once.
  4. awardPoints() only saves in the browser. Hangouts and Skill Swaps must
     award points in their own database functions (like confirm_help_done),
     not by calling awardPoints(). After an action that earns points, call
     usePointsStore().load() so the navbar updates.
  5. Empty states: make sure the page works for someone with zero points and
     an empty wallet (<EmptyState> is already used).

  6. Tests (e2e/rewards.spec.js, copy the style of e2e/helpboard.spec.js)
     Redeem a voucher, points go down, the code is in the wallet, and
     redeeming with too few points is refused.

  SENIOR-FRIENDLY RULES (also in README.md and CONTRIBUTING.md)
  Plain short sentences, big buttons, one main action per screen, never use
  colour alone to show a state. Check your layout at 22px text and on a phone.
*/

import { ref, computed } from 'vue'
import { usePointsStore } from '../../stores/points.js'
import { useWalletStore } from '../../stores/wallet.js'
import { vouchers, voucherTypes } from '../../lib/vouchers.js'
import VoucherCard from '../../components/VoucherCard.vue'
import EmptyState from '../../components/EmptyState.vue'

const pointsStore = usePointsStore()
const walletStore = useWalletStore()

// Tab: 'shop' or 'wallet'
const activeTab = ref('shop')

const searchQuery = ref('')
const selectedType = ref('All')
const activeModalVoucher = ref(null)

// Confirmation modal before spending
const voucherToConfirm = ref(null)
const message = ref('')
const error = ref('')

// Filter by search text and category
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

// Generates a Google Maps link to search for nearby outlets
function getGoogleMapsUrl(voucher) {
  if (!voucher) return '#'
  const query = voucher.mapQuery || `${voucher.merchant} near me`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// Format date for wallet items
function formatDate(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// 1. User clicks "Redeem" -> opens confirmation modal
function promptRedeem(voucher) {
  activeModalVoucher.value = null
  voucherToConfirm.value = voucher
  message.value = ''
  error.value = ''
}

// 2. User confirms redemption
function confirmRedeem() {
  if (!voucherToConfirm.value) return

  const result = walletStore.redeem(voucherToConfirm.value.id)
  const redeemedVoucher = voucherToConfirm.value
  voucherToConfirm.value = null

  if (result.ok) {
    message.value = `Success! You redeemed "${redeemedVoucher.title}". Your code is ${result.item.code}.`
    activeTab.value = 'wallet'
  } else {
    error.value = result.error
  }
}
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

    <!-- Feedback messages -->
    <div v-if="message" class="alert alert-success alert-dismissible show mb-4" role="status">
      {{ message }}
      <button type="button" class="btn-close" aria-label="Close" @click="message = ''"></button>
    </div>
    <div v-if="error" class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
      {{ error }}
      <button type="button" class="btn-close" aria-label="Close" @click="error = ''"></button>
    </div>


    <!--community challenge-->
    <div class="card border-0 rounded-4 mb-4 text-white overflow-hidden community-challenge-card">
      <div class="card-body p-4 position-relative">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div>
            <span class="badge bg-warning text-dark px-3 py-1 rounded-pill  fw-bold mb-1">
               Monthly Estate Challenge
            </span>
            <h2 class="h5 fw-bold mb-0 text-white">Eunos Kampung Spirit Goal</h2>
          </div>
          <!-- Numbers as text -->
          <div class="text-end">
            <span class="fs-5 fw-bold font-monospace">
              {{ pointsStore.communityPointsThisMonth.toLocaleString() }} of {{ pointsStore.COMMUNITY_TARGET.toLocaleString() }}
            </span>
            <small class="d-block text-white-50">points earned this month</small>
          </div>
        </div>

        <!--Progress Bar -->
        <div
          class="progress my-3 bg-white bg-opacity-25 rounded-pill"
          style="height: 18px;"
          role="progressbar"
          :aria-valuenow="pointsStore.communityPointsThisMonth"
          aria-valuemin="0"
          :aria-valuemax="pointsStore.COMMUNITY_TARGET"
          :aria-label="`Community progress: ${pointsStore.communityProgress}%`"
        >
          <div
            class="progress-bar progress-bar-striped progress-bar-animated bg-warning text-dark fw-bold rounded-pill"
            :style="{ width: pointsStore.communityProgress + '%' }"
          >
            <span v-if="pointsStore.communityProgress >= 15" class="small">
              {{ pointsStore.communityProgress }}%
            </span>
          </div>
        </div>

        <!-- Target status & Bonus description -->
        <div class="d-flex flex-wrap justify-content-between align-items-center small text-white-50 gap-2">
          <span>
            {{
              pointsStore.isCommunityTargetReached
                ? 'Target reached! All contributors received a +50 pts bonus.'
                : `${(pointsStore.COMMUNITY_TARGET - pointsStore.communityPointsThisMonth).toLocaleString()} more points to unlock a 50 pts bonus for all contributors!`
            }}
          </span>
          <span class="text-white fw-semibold">{{ pointsStore.communityProgress }}% achieved</span>
        </div>
      </div>
    </div>
    <!-- Tab Toggle: Browse vs My Wallet -->
    <div class="btn-group w-100 mb-4" role="group" aria-label="Rewards view">
      <button
        type="button"
        class="btn btn-lg"
        :class="activeTab === 'shop' ? 'btn-primary' : 'btn-outline-primary'"
        @click="activeTab = 'shop'"
      >
         Browse Vouchers
      </button>
      <button
        type="button"
        class="btn btn-lg d-flex align-items-center justify-content-center gap-2"
        :class="activeTab === 'wallet' ? 'btn-primary' : 'btn-outline-primary'"
        @click="activeTab = 'wallet'"
      >
         My Wallet
        <span v-if="walletStore.unusedCount > 0" class="badge bg-warning text-dark rounded-pill">
          {{ walletStore.unusedCount }}
        </span>
      </button>
    </div>

    <!-- Browse Voucher Tab -->
    <div v-if="activeTab === 'shop'">

      <!--  Search Bar-->
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

      <!-- Category Filters -->
      <div class="d-flex gap-2 overflow-auto pb-2 mb-4" role="tablist">
        <button
          v-for="t in voucherTypes"
          :key="t.name"
          type="button"
          class="btn rounded-pill px-3 text-nowrap d-inline-flex align-items-center gap-2"
          :class="selectedType === t.name ? 'btn-primary active text-white' : 'btn-outline-secondary bg-white'"
          @click="selectedType = t.name"
        >
          <!-- <span>{{ t.icon }}</span> -->
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
      <EmptyState v-if="filteredVouchers.length === 0" message="No matching rewards found. Try a different search." />

      <div v-else class="row row-cols-1 row-cols-md-2 g-4">
        <div v-for="voucher in filteredVouchers" :key="voucher.id" class="col">
          <VoucherCard
            :voucher="voucher"
            :can-afford="pointsStore.myPoints >= voucher.cost"
            @select="activeModalVoucher = $event"
          />
        </div>
      </div>
    </div>

    <!-- My Wallet tab -->
    <div v-else>
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2 class="h4 fw-bold mb-0">My Vouchers</h2>
        <span class="text-muted small">{{ walletStore.myWallet.length }} total</span>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-if="walletStore.myWallet.length === 0"
        message="Your wallet is empty. Earn points from tasks and redeem vouchers from the shop!"
      >
        <button class="btn btn-primary btn-lg mt-3" @click="activeTab = 'shop'">
          Browse Vouchers
        </button>
      </EmptyState>

      <!-- Wallet List -->
      <div v-else class="row row-cols-1 row-cols-md-2 g-4">
        <div v-for="item in walletStore.myWallet" :key="item.id" class="col">
          <div class="card h-100 shadow-sm border rounded-4" :class="{ 'opacity-75 bg-light': item.used }">
            <div class="card-body p-4 d-flex flex-column justify-content-between">
              <div>
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h5 class="fw-bold mb-0 text-dark">{{ item.voucher.merchant || 'Merchant' }}</h5>
                    <p class="text-muted small mb-0">{{ item.voucher.title }}</p>
                  </div>
                  <span
                    v-if="!item.used"
                    class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1"
                  >
                     Ready to use
                  </span>
                  <span v-else class="badge bg-secondary-subtle text-secondary border rounded-pill px-3 py-1">
                    Used
                  </span>
                </div>

                <!-- Big Voucher Code -->
                <div class="p-3 my-3 bg-white border border-2 border-dashed rounded-3 text-center">
                  <div class="text-muted small mb-1">VOUCHER CODE</div>
                  <div class="fs-3 fw-bold font-monospace text-primary tracking-wide">
                    {{ item.code }}
                  </div>
                  <small class="text-muted d-block mt-1">Show this code at the cashier counter</small>
                </div>

                <p class="small text-muted mb-2">
                  <strong>Terms:</strong> {{ item.voucher.terms }}
                </p>
                <small class="text-muted d-block">
                  Redeemed on {{ formatDate(item.redeemedAt) }}
                </small>
              </div>

              <!-- Mark as used button -->
              <div class="pt-3 mt-3 border-top d-flex justify-content-between align-items-center">
                <span v-if="item.used" class="text-muted small">
                  Used on {{ formatDate(item.usedAt) }}
                </span>
                <button
                  v-else
                  type="button"
                  class="btn btn-outline-secondary btn-sm rounded-pill ms-auto"
                  @click="walletStore.markAsUsed(item.id)"
                >
                  Mark as used
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Voucher Details Modal -->
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
            <button type="button" class="btn-close" aria-label="Close" @click="activeModalVoucher = null"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3 text-center p-3 rounded-3" :style="{ backgroundColor: activeModalVoucher.bg }">
              <img
                :src="activeModalVoucher.logo"
                :alt="activeModalVoucher.merchant"
                style="height: 80px; object-fit: contain;"
                @error="$event.target.style.display = 'none'"
              />
            </div>
            <h3 class="h5 fw-bold mb-1">{{ activeModalVoucher.title }}</h3>
            <!-- Google Maps Link for Nearby Outlets -->
            <div class="mb-3">
              <a
                :href="getGoogleMapsUrl(activeModalVoucher)"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-outline-primary rounded-pill d-inline-flex align-items-center gap-1 text-decoration-none px-3 py-1"
              >
                <span>Find {{ activeModalVoucher.merchant }} near me</span>
                <span class="small" aria-hidden="true">↗</span>
              </a>
            </div>

            <p class="mb-3">{{ activeModalVoucher.description }}</p>

            <div class="alert alert-light border d-flex justify-content-between align-items-center mb-3">
              <span><strong>Cost:</strong> {{ activeModalVoucher.cost }} pts</span>
              <span class="text-muted small">
                Your balance: <strong>{{ pointsStore.myPoints }} pts</strong>
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
              @click="promptRedeem(activeModalVoucher)"
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

    <!-- Confirm Redemption Modal (Copied from SeniorHelpBoardView pattern) -->
    <div
      v-if="voucherToConfirm"
      class="modal show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-redeem-title"
      @click.self="voucherToConfirm = null"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-header">
            <h2 id="confirm-redeem-title" class="modal-title h5 fw-bold">Confirm Redemption?</h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="voucherToConfirm = null"
            ></button>
          </div>
          <div class="modal-body fs-6">
            <p>
              Spend <strong>⭐ {{ voucherToConfirm.cost }} points</strong> to redeem
              <strong>{{ voucherToConfirm.title }}</strong> from
              <strong>{{ voucherToConfirm.merchant }}</strong>?
            </p>
            <p class="text-muted small mb-0">Points cannot be refunded once redeemed.</p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary rounded-pill px-3"
              @click="voucherToConfirm = null"
            >
              Keep my points
            </button>
            <button
              type="button"
              class="btn btn-primary rounded-pill px-4"
              data-testid="confirm-redeem"
              @click="confirmRedeem"
            >
              Yes, redeem
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeModalVoucher || voucherToConfirm" class="modal-backdrop show"></div>
  </div>
</template>

<style>
.community-challenge-card {
  background:  #0b6e6e ;
}
</style>