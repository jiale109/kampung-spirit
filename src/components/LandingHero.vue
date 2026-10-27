<script setup>
/*
  The left half of the login and sign-up pages: the brand and tagline over
  photos that slide by on their own every few seconds. There are no buttons or
  dots; nobody needs to touch it.

  - Photos live in public/images/landing/. Add or remove one in `photos` below.
  - The photos are decoration (the words say what the app is), so they have
    empty alt text and screen readers skip them.
  - People who ask their device for less motion get a slow fade instead of the
    slide. The slideshow also pauses while the browser tab is hidden.
*/
import { ref, computed, onMounted, onUnmounted } from 'vue'
import BrandMark from './BrandMark.vue'

const photos = [
  '/images/landing/photo-1.webp',
  '/images/landing/photo-2.webp',
  '/images/landing/photo-3.webp',
  '/images/landing/photo-4.webp',
  '/images/landing/photo-5.webp',
  '/images/landing/photo-6.webp',
  '/images/landing/photo-7.webp',
  '/images/landing/photo-8.webp',
]
const CHANGE_EVERY_MS = 5000

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Slide: a strip of photos moved one width to the left each time. The first
// photo is repeated at the end, so the last photo slides on to the first one
// instead of rewinding through them all.
const slides = reduceMotion ? photos : [...photos, photos[0]]
const index = ref(0)
const animate = ref(true)

const trackStyle = computed(() => ({
  transform: `translateX(-${index.value * 100}%)`,
  transition: animate.value ? undefined : 'none',
}))

function next() {
  if (reduceMotion) {
    index.value = (index.value + 1) % photos.length
  } else {
    animate.value = true
    index.value += 1
  }
}

// Reached the repeated first photo: jump back to the real one without sliding
function onSlideEnd() {
  if (index.value === photos.length) {
    animate.value = false
    index.value = 0
  }
}

let timer = null
const start = () => {
  stop()
  timer = setInterval(next, CHANGE_EVERY_MS)
}
const stop = () => clearInterval(timer)
const onVisibilityChange = () => (document.hidden ? stop() : start())

onMounted(() => {
  start()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="col-lg-6 landing-hero landing-hero--photos">
    <div class="hero-photos" aria-hidden="true">
      <!-- Fade (less motion): photos stacked, the current one fully visible -->
      <template v-if="reduceMotion">
        <img v-for="(src, i) in slides" :key="src" :src="src" alt="" class="hero-photo hero-photo--fade"
          :class="{ 'is-current': i === index }" />
      </template>

      <!-- Slide -->
      <div v-else class="hero-track" :style="trackStyle" @transitionend.self="onSlideEnd">
        <img v-for="(src, i) in slides" :key="i" :src="src" alt="" class="hero-photo" />
      </div>

      <!-- Darkens the top and bottom so the white words stay easy to read -->
      <div class="hero-shade"></div>
    </div>

    <p class="landing-brand"><BrandMark :size="128" />Kampung Spirit</p>
    <h1 class="landing-tagline">Neighbours helping neighbours, one small favour at a time.</h1>
  </div>
</template>

<style scoped>
.landing-hero--photos {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  min-height: 24rem;
}

.hero-photos {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.hero-track {
  display: flex;
  height: 100%;
  transition: transform 0.9s ease-in-out;
}

.hero-photo {
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  user-select: none;
  pointer-events: none;
}

.hero-photo--fade {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.5s ease;
}

.hero-photo--fade.is-current {
  opacity: 1;
}

.hero-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(6, 40, 40, 0.7) 0%,
    rgba(6, 40, 40, 0.15) 35%,
    rgba(6, 40, 40, 0.25) 55%,
    rgba(6, 40, 40, 0.85) 100%
  );
}

.landing-brand,
.landing-tagline {
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
}
</style>
