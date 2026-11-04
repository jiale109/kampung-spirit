<script setup>
/*
  Brand mark                                            Owner: Clarence Tay
  The pixel-art village shown next to "Kampung Spirit" in the navbars and on
  the landing and sign-up pages. Used in MainLayout, LandingView and
  RegisterView -- change it here, not there.

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

  /*
    The village is not in the middle of its own picture. Measured on the
    rendered file at 64px: about 7px of empty sky above the artwork and none
    at all below it. So lining the IMAGE up with the words still leaves the
    village looking a few pixels low, which is what it was doing.

    -6.25% is one sixteenth of the icon's height. A percentage, not a pixel
    count, because transform percentages are read against the element's own
    size: that is 4px at size 64 and 8px at size 128, so the landing page
    gets the same correction without a second number to keep in step.

    One sixteenth, rather than the 5.7% that would be exact, because the
    artwork is drawn on a 64px pixel grid. 1/16 of 64 is 4 whole pixels and
    1/16 of 128 is 8, so every drawn pixel still lands on a whole screen
    pixel. A truer figure would move it by a fraction of a pixel and the
    browser would soften the edges to manage it - the same fuzziness the
    note at the top of this file warns about. The leftover error is under
    half a pixel, which no one can see; blurred pixel art, they can.

    A transform does not take part in layout, so nothing moves around it.
  */
  transform: translateY(-6.25%);
}
</style>
