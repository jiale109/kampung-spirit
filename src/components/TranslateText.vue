<script setup>
/*
  "Read this in another language" for one piece of text   Owner: Clarence Tay

  Dropped under the description on a request, a hangout or a skill swap card.
  It adds the translation BELOW the original rather than replacing it: what
  the neighbour actually wrote stays on the screen, so nobody has to trust a
  machine to have got it right, and the host can still be asked about their
  own words.

  Nothing here talks to the network directly - lib/translate.js does, and it
  returns { ok, text } instead of throwing, so the states below are just
  three possibilities rather than a try/catch.
*/
import { ref } from 'vue'
import { translate, LANGUAGES, nextSelectId } from '../lib/translate.js'

/*
  Every card on the page renders one of these, so <label for> needs an id
  that differs each time - otherwise every label on the page would point at
  the first card's select. The counter lives in the lib; see the note there.
*/
const selectId = nextSelectId()

const props = defineProps({
  // The neighbour's own words
  text: { type: String, default: '' },
})

const chosen = ref('')
const result = ref('')
const problem = ref('')
const busy = ref(false)

async function show() {
  if (chosen.value === '') return
  busy.value = true
  problem.value = ''
  result.value = ''

  const answer = await translate(props.text, chosen.value)
  if (answer.ok) result.value = answer.text
  else problem.value = answer.error

  busy.value = false
}

// Picking a different language clears the last answer, so the heading and the
// words underneath can never disagree about which language is on screen
function pick() {
  result.value = ''
  problem.value = ''
}
</script>

<template>
  <div v-if="text" class="translate-block" data-testid="translate">
    <label class="translate-label" :for="selectId">Read this in another language</label>

    <div class="translate-row">
      <select :id="selectId" v-model="chosen" class="form-select translate-select"
        data-testid="translate-language" @change="pick">
        <option value="">Choose a language</option>
        <option v-for="language in LANGUAGES" :key="language.code" :value="language.code">
          {{ language.label }}
        </option>
      </select>

      <button type="button" class="btn btn-outline-secondary" data-testid="translate-go"
        :disabled="chosen === '' || busy" @click="show">
        {{ busy ? 'Translating…' : 'Translate' }}
      </button>
    </div>

    <!--
      aria-live, because the answer arrives after the press and a screen
      reader would otherwise say nothing at all. lang= matters too: without
      it a screen reader reads Chinese with an English voice.
    -->
    <p v-if="result" class="translate-result" :lang="chosen" aria-live="polite"
      data-testid="translate-result">{{ result }}</p>

    <p v-else-if="problem" class="translate-problem" role="status"
      data-testid="translate-problem">{{ problem }}</p>

    <p v-if="result" class="translate-note">
      Translated by machine. The neighbour's own words are above.
    </p>
  </div>
</template>
