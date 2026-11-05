<script setup>
/*
  "How Kampung Spirit works": the part of the home page below the photos,
  for people who have not signed up yet. Three sections and a sign-up band.
  Each card fades up as it scrolls into view (composables/useReveal.js).
  "What you can do" is one wide row per feature, picture and words swapping
  sides each row, so each one has room to breathe.

  The three pictures are animated pixel-art SVGs in public/images/landing
  (feature-*.svg), in the same colours as the logo. They move by themselves
  with CSS inside each file, and stand still for anyone whose device asks for
  less movement.
*/
import { ref } from 'vue'
import { useReveal } from '../composables/useReveal.js'
import LandingHero from './LandingHero.vue'

const root = ref(null)
useReveal(root)

const steps = [
  { title: 'Sign up', text: 'Tell us your name, your block and your birthday. It takes two minutes.' },
  { title: 'Ask or offer', text: 'Post what you need, or browse what neighbours nearby need.' },
  { title: 'Meet up', text: 'Help with groceries, a phone or a walk. Everything is arranged in the app.' },
  { title: 'Earn points', text: 'Every time you help a neighbour, you earn points.' },
]

const features = [
  {
    title: 'Help Board',
    text: 'Need a hand with groceries, your phone or a walk to the clinic? Post it, and a neighbour nearby can say "I can help."',
    image: '/images/landing/feature-help.svg',
  },
  {
    title: 'Hangouts',
    text: 'Kopi, a morning walk, gardening. Small, easy get-togethers at places you know. Propose one yourself, or join one in a single tap.',
    image: '/images/landing/feature-hangout.svg',
  },
  {
    title: 'Skill Swaps',
    text: "Teach what you're good at, or learn something new from the people next door, from kueh making to staying safe online.",
    image: '/images/landing/feature-skills.svg',
  },
]

const safety = [
  {
    title: 'Parents stay in the loop',
    text: 'Under-18s need a parent or guardian to confirm before they can help, only between 8 am and 7 pm, and never inside a home.',
  },
  {
    title: 'No sharing phone numbers',
    text: 'Requests cannot include contact details. You talk through the app.',
  },
  {
    title: 'A heads-up for heavy tasks',
    text: 'Seniors are warned before taking on anything physical.',
  },
  {
    title: 'Updates on Telegram',
    text: 'Get a message when someone accepts or joins, without sharing your number.',
  },
]

// One card after another, 120ms apart
const delay = (i) => ({ '--reveal-delay': `${i * 120}ms` })
</script>

<template>
  <div ref="root" class="landing-story">

    <section id="how-it-works" class="story-section" aria-labelledby="how-title">
      <div class="story-inner">
        <h2 id="how-title" class="story-title" data-reveal>Neighbours helping neighbours, in four steps</h2>
        <ol class="story-steps">
          <li v-for="(step, i) in steps" :key="step.title" class="card story-step" data-reveal :style="delay(i)">
            <span class="step-number" aria-hidden="true">{{ i + 1 }}</span>
            <h3 class="story-card-title">{{ step.title }}</h3>
            <p class="mb-0">{{ step.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="story-section story-section--white" aria-labelledby="features-title">
      <div class="story-inner">
        <h2 id="features-title" class="story-title" data-reveal>What you can do</h2>
        <div class="story-features">
          <!-- Every other row puts the picture on the right (see .story-feature in theme.css) -->
          <article v-for="feature in features" :key="feature.title" class="story-feature">
            <!-- Decorative: the title and text beside it say what it shows -->
            <img :src="feature.image" alt="" class="feature-picture" width="384" height="288" data-reveal="pop" />
            <div class="feature-words" data-reveal style="--reveal-delay: 150ms">
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-text mb-0">{{ feature.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Real photos of neighbours: a break between the drawings and the safety points -->
    <LandingHero />

    <section class="story-section" aria-labelledby="safety-title">
      <div class="story-inner">
        <h2 id="safety-title" class="story-title" data-reveal>Built with care for young and old</h2>
        <ul class="story-safety">
          <li v-for="(item, i) in safety" :key="item.title" class="card story-safety-item" data-reveal
            :style="delay(i)">
            <span class="safety-tick" aria-hidden="true">✓</span>
            <div>
              <h3 class="story-card-title">{{ item.title }}</h3>
              <p class="mb-0">{{ item.text }}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section class="story-cta" aria-labelledby="cta-title">
      <div class="story-inner text-center" data-reveal>
        <h2 id="cta-title" class="story-title text-white">Ready to meet your neighbours?</h2>
        <router-link to="/register" class="btn btn-light btn-lg story-cta-button">Create an account</router-link>
        <p class="mt-4 mb-0">
          Already have one?
          <router-link to="/login" class="story-cta-login">Log in</router-link>
        </p>
      </div>
    </section>

  </div>
</template>
