/*
  Fade things in as they scroll into view.

  Give the part of the page a template ref and call useReveal(thatRef). Every
  element inside it with a data-reveal attribute starts hidden and fades up
  the first time it comes on screen (once only: scrolling back up does not
  replay it). Set --reveal-delay on an element (e.g. style="--reveal-delay:
  150ms") to have cards come in one after another.

  The styles are in theme.css, section 10. Nothing is hidden until this has
  run, so the content is never lost if JavaScript fails, and anyone whose
  device asks for less movement simply sees everything straight away.
*/
import { onMounted, onUnmounted } from 'vue'

export function useReveal(root) {
  let observer = null

  onMounted(() => {
    const items = [...root.value.querySelectorAll('[data-reveal]')]
    const show = (el) => el.classList.add('is-revealed')

    const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (lessMotion || !('IntersectionObserver' in window)) {
      items.forEach(show)
      return
    }

    root.value.classList.add('reveal-ready')
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          show(entry.target)
          observer.unobserve(entry.target)
        }
      },
      // Start a little after the top edge of the item comes on screen
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    items.forEach((el) => observer.observe(el))
  })

  onUnmounted(() => observer?.disconnect())
}
