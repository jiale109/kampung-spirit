/*
  Show people what went wrong when a form will not save.

  Most of our forms are longer than a phone screen, so the problem is often
  off screen: a field marked red higher up, or a "could not save" message at
  the top. Pressing the button then looks as if nothing happened, and older
  residents may not think to scroll up. So every form calls one of these
  straight after it finds a problem:

    showFirstError(formElement)   after checking the fields: finds the first
                                  field marked wrong (is-invalid, or a red
                                  message under it) in page order
    showElement(element)          when the form already knows which element,
                                  e.g. the alert holding a server's message.
                                  May be a function that returns it, for an
                                  element that only appears once the error is
                                  set (v-if): it is looked up after Vue draws.

  Either one scrolls the element to the MIDDLE of the screen (not hard
  against an edge, where it is easy to miss or sits under the top bar) and
  puts the cursor in the field, so the person can type the fix straight
  away. It glides unless the device asks for less movement.
*/
import { nextTick } from 'vue'

// Something marked wrong, or a message saying so
const PROBLEM = '.is-invalid, [aria-invalid="true"], .invalid-feedback.d-block, [role="alert"]'
// What can take the cursor
const FIELD = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'

const lessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The field a problem belongs to, or null for a message about the whole form
function fieldFor(problem) {
  if (problem.matches(FIELD)) return problem
  // A red message under a field: the field is beside it, in the same group
  if (problem.matches('.invalid-feedback')) return problem.parentElement?.querySelector(FIELD) ?? null
  // Anything else (a "could not save" alert) is about the whole form
  return null
}

export async function showElement(target) {
  // Wait for Vue to draw the red borders and messages first
  await nextTick()
  const element = typeof target === 'function' ? target() : target
  if (!element) return
  element.scrollIntoView({ behavior: lessMotion() ? 'auto' : 'smooth', block: 'center' })
  // preventScroll: the scroll above already put it in the middle
  const field = fieldFor(element)
  if (field) {
    field.focus({ preventScroll: true })
    return
  }
  // A message for the whole form: give it focus, so a screen reader reads it
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1')
  element.focus({ preventScroll: true })
}

export async function showFirstError(container) {
  await nextTick()
  const root = container?.$el ?? container ?? document
  await showElement(root.querySelector(PROBLEM))
}
