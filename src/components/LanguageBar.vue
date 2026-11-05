<script setup>
/*
  "Read this in"                                        Owner: Clarence Tay

  One row of language buttons. Tapping one switches the card into that
  language in place - the words change where they already are, rather than a
  second box appearing underneath with a copy of them.

  WHY BUTTONS AND NOT A DROPDOWN
  A dropdown is two taps (open it, pick) and hides the choices until you
  open it. Four buttons are one tap and show all four languages at once, each
  written in its own script, so someone who does not read English can find
  theirs by recognising it. That matters more here than saving a bit of room.

  WHY THE LANGUAGE IS SHARED, NOT PER CARD
  setLanguage puts the choice in one ref that the whole app reads (see
  lib/translate.js), so picking Melayu on one card switches every card, the
  dates and the buttons at the same time. A resident who reads Malay wants
  the app in Malay - not to re-pick it on each card they open.

  The card is told through @change so it can fetch its own title and
  description, which are the only parts that need the network.
*/
import { chosenLanguage, setLanguage, LANGUAGES, t } from '../lib/translate.js'

const emit = defineEmits(['change'])

function pick(code) {
  setLanguage(code)
  emit('change', code)
}
</script>

<template>
  <div class="language-bar" data-testid="language-bar">
    <span class="language-bar-label">{{ t('Read this in') }}</span>

    <div class="language-bar-row">
      <!--
        aria-pressed, not just a colour: a screen reader has to be able to say
        which language is the current one, and colour alone does not reach it.
      -->
      <button
        v-for="language in LANGUAGES"
        :key="language.code"
        type="button"
        class="btn language-chip"
        :class="chosenLanguage === language.code ? 'btn-primary' : 'btn-outline-secondary'"
        :aria-pressed="chosenLanguage === language.code"
        :lang="language.code || 'en'"
        :data-testid="`language-${language.code || 'en'}`"
        @click="pick(language.code)"
      >
        {{ language.label }}
      </button>
    </div>
  </div>
</template>
