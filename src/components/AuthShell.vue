<script setup>
/*
  The plain frame around the login and sign-up forms: the logo (a link back
  to the home page) above one centred card. Put the form inside:
    <AuthShell> ...form... </AuthShell>
*/
import BrandMark from './BrandMark.vue'
</script>

<template>
  <div class="auth-page">
    <router-link to="/landing" class="topbar-brand auth-brand">
      <BrandMark :size="64" />Kampung Spirit
    </router-link>
    <div class="card auth-card">
      <div class="card-body">
        <slot />
      </div>
    </div>
  </div>
</template>
