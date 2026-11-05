<script setup>
/*
  Home page for people who are not logged in                Owner: Reuben Tham
  A bar along the top that stays put while scrolling (Log in and Sign up),
  a short intro with a pixel-art scene, then components/LandingStory.vue,
  which explains the app (the photo carousel is in there too). Logging in
  is its own page (views/LoginView.vue, /login) and so is signing up
  (views/RegisterView.vue, /register).
*/
import LandingStory from '../components/LandingStory.vue'
import BrandMark from '../components/BrandMark.vue'

// Glides down, unless the device asks for less movement
function showHowItWorks() {
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('how-it-works').scrollIntoView({ behavior: lessMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <div>
    <header class="landing-topbar">
      <!-- Lined up with the page content below, while the white bar runs edge to edge -->
      <div class="topbar-inner">
        <router-link to="/landing" class="topbar-brand">
          <BrandMark :size="64" />
          <span class="topbar-brand-name">Kampung Spirit</span>
        </router-link>
        <nav class="topbar-actions" aria-label="Your account">
          <router-link to="/login" class="btn btn-lg btn-outline-primary" data-testid="topbar-login">Log in</router-link>
          <router-link to="/register" class="btn btn-lg btn-primary" data-testid="topbar-signup">Sign up</router-link>
        </nav>
      </div>
    </header>

    <!-- No buttons here: Log in and Sign up are always in the bar above -->
    <section class="landing-intro" aria-labelledby="intro-title">
      <div class="landing-intro-words">
        <h1 id="intro-title" class="landing-intro-title">Neighbours helping neighbours, one small favour at a time.</h1>
        <p class="landing-intro-text">
          Ask for a hand, lend one, and get to know the people in your block. Made for HDB estates all over Singapore.
        </p>
        <button type="button" class="btn btn-link see-how p-0" data-testid="see-how" @click="showHowItWorks">
          See how Kampung Spirit works <span aria-hidden="true">↓</span>
        </button>
      </div>
      <!-- Decorative: the heading beside it says what the app is -->
      <img src="/images/landing/feature-hero.svg" alt="" class="landing-intro-picture" width="576" height="288" />
    </section>

    <LandingStory />
  </div>
</template>
