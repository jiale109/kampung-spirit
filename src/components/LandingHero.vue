<script setup>
/*
  A full-width band of photos on the home page (inside LandingStory.vue,
  after "What you can do"), with one line over them. The photos slide by on
  their own every few seconds. There are no buttons or dots; nobody needs to
  touch it.

  - Photos live in public/images/landing/. Add or remove one in `photos` below.
  - The photos are decoration (the words say what the app is), so they have
    empty alt text and screen readers skip them.
  - People who ask their device for less motion get a slow fade instead of the
    slide. The slideshow also pauses while the browser tab is hidden.
*/
import { ref, computed, onMounted, onUnmounted } from 'vue'

/*
  focus is how far down each photo the faces are (0% top, 100% bottom). The
  band is cropped to fit the screen, and this keeps the faces in the part
  that shows. Adding a photo? Open it, look where the faces sit, set focus.
*/
const photos = [
  { src: '/images/landing/photo-1.webp', focus: '25%' },
  { src: '/images/landing/photo-2.webp', focus: '30%' },
  { src: '/images/landing/photo-3.webp', focus: '40%' }, // close-up selfie, nearly square
  { src: '/images/landing/photo-4.webp', focus: '15%' },
  { src: '/images/landing/photo-5.webp', focus: '30%' },
  { src: '/images/landing/photo-6.webp', focus: '30%' }, // nearly square
  { src: '/images/landing/photo-7.webp', focus: '20%' },
  { src: '/images/landing/photo-8.webp', focus: '35%' },
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
  <div class="landing-hero landing-hero--photos photo-band">
    <div class="hero-photos" aria-hidden="true">
      <!-- Fade (less motion): photos stacked, the current one fully visible -->
      <template v-if="reduceMotion">
        <img v-for="(photo, i) in slides" :key="photo.src" :src="photo.src" alt="" class="hero-photo hero-photo--fade"
          :style="{ objectPosition: `center ${photo.focus}` }"
          :class="{ 'is-current': i === index }" />
      </template>

      <!-- Slide -->
      <div v-else class="hero-track" :style="trackStyle" @transitionend.self="onSlideEnd">
        <img v-for="(photo, i) in slides" :key="i" :src="photo.src" alt="" class="hero-photo"
          :style="{ objectPosition: `center ${photo.focus}` }" />
      </div>

      <!-- Darkens the bottom so the white words stay easy to read -->
      <div class="hero-shade"></div>
    </div>

    <p class="landing-tagline photo-band-caption">Real neighbours, real favours, all over Singapore.</p>
  </div>
</template>

<style scoped>
.landing-hero--photos {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

/*
  The same shape as the photos (most are about 16:9), so little is cropped
  and nobody's head is cut off: 56.25vw is 9/16 of the screen width. Never
  taller than most of the screen, and on phones never so short that the
  words over the photo have no room.
*/
.photo-band {
  justify-content: flex-end;
  height: clamp(16rem, 56.25vw, 85vh);
  /* The photos run edge to edge, but the words line up with the page column */
  padding-inline: max(var(--landing-gutter), calc((100% - var(--landing-width)) / 2));
}

.photo-band-caption {
  max-width: 22ch;
}

/* Phones: smaller, so the line takes less of the photo and covers fewer faces */
@media (max-width: 575.98px) {
  .photo-band-caption {
    font-size: 1.3rem;
  }

  /* A little taller than the photos' shape, so the faces sit above the words */
  .photo-band {
    height: 22rem;
  }
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
    rgba(6, 40, 40, 0) 0%,
    rgba(6, 40, 40, 0.1) 45%,
    rgba(6, 40, 40, 0.85) 100%
  );
}

.landing-tagline {
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
}
</style>
