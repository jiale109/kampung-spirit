<script setup>
/*
  Brand mark                                            Owner: Clarence Tay
  The pixel-art village shown next to "Kampung Spirit" in the navbars and on
  the landing and sign-up pages. Used in MainLayout, SeniorViewsLayout,
  YouthViewsLayout, LandingView and RegisterView -- change it here, not there.

  size is in pixels. The artwork is drawn on a 64px pixel-art grid, so only
  use 32, 64 or 128: those are 1:2, 1:1 and 2:1, where every drawn pixel
  lands on a whole number of screen pixels. In-between sizes (48, 80, 100)
  scale the grid by a fraction, so some pixels come out wider than others
  and the whole thing looks fuzzy.

  Decorative only: the words "Kampung Spirit" always sit right beside it, so
  alt="" keeps a screen reader from announcing the same thing twice.
*/
defineProps({
  size: { type: Number, default: 64 },
})
</script>

<template>
  <img
    class="brand-mark"
    src="/images/kampung-spirit-icon.svg"
    alt=""
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
</template>

<style scoped>
.brand-mark {
  vertical-align: middle;
  margin-right: 0.5rem;
}
</style>
