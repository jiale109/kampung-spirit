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
import EmptyState from '../../components/EmptyState.vue'
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Rewards</h1>
        <p class="page-subtitle">Turn your points into vouchers from local shops.</p>
      </div>
    </div>

    <EmptyState message="Rewards are coming soon." />
  </div>
</template>
