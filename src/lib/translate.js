/*
  GUIDE (Owner: Clarence Tay): every translation call lives here.

  WHAT THIS IS FOR
  The words NEIGHBOURS WRITE - the title and description of a help request, a
  hangout or a skill swap. Not the interface. Buttons and labels are not
  translated through an API: that would pay to translate "Hangouts" on every
  page load, and a machine's guess at a three-word button is exactly the kind
  of thing a resident cannot afford to misread.

  WHY MyMemory
  It needs no API key, and it allows calls straight from the browser (CORS),
  so there is no server to run and no secret to leak. A Vue app ships its
  source to the browser, so a key in .env would be readable by anyone who
  opens the developer tools - which is worth remembering about
  VITE_ONEMAP_TOKEN too.

  Free allowance is about 5,000 words a day from one address. The cache below
  is what keeps a demo inside that: without it, every re-render of a list
  would spend the quota again on words it has already translated.

  Docs: https://mymemory.translated.net/doc/spec.php

  THE LIMITATION, SAID OUT LOUD
  Every call says the original is English (FROM below). That is true of
  everything in the app today, and it covers the case this was built for: a
  resident who reads Chinese, Malay or Tamil opening a post written in
  English. Going the other way - a senior writing in Mandarin for a youth to
  read - needs the source changed, which is the third argument to translate().
  MyMemory may support an "Autodetect" source; it is not in the part of the
  documentation this was written from, so it is not relied on here.
*/
import axios from 'axios'

const ENDPOINT = 'https://api.mymemory.translated.net/get'

// What the app's posts are written in today
const FROM = 'en'

/*
  The four languages of Singapore. The label is in the language itself, so
  someone looking for their own language recognises it without reading
  English first.
*/
export const LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'ta', label: 'தமிழ்' },
]

/*
  Answers already paid for. A plain Map, held for as long as the page is
  open: one key per piece of text per language, so opening the same card
  twice costs one call, not two.
*/
const seen = new Map()

/*
  Returns { ok: true, text } or { ok: false, error }, never throws, so a card
  can show what went wrong without a try/catch of its own.
*/
export async function translate(text, to, from = FROM) {
  const original = String(text ?? '').trim()
  if (original === '') return { ok: false, error: 'There is nothing to translate.' }
  if (!to || to === from) return { ok: true, text: original }

  const key = `${from}|${to}|${original}`
  if (seen.has(key)) return { ok: true, text: seen.get(key) }

  try {
    const response = await axios.get(ENDPOINT, {
      params: { q: original, langpair: `${from}|${to}` },
      timeout: 10000,
    })

    const translated = response.data?.responseData?.translatedText ?? ''

    /*
      MyMemory answers 200 OK even when it is refusing. The daily limit comes
      back as a sentence IN the translated text, so checking the status code
      alone would show "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE
      TRANSLATIONS" to a resident as though it were their translation.
    */
    if (translated === '' || translated.toUpperCase().includes('MYMEMORY WARNING')) {
      return { ok: false, error: 'Translation is not available just now. Please try again later.' }
    }

    seen.set(key, translated)
    return { ok: true, text: translated }
  } catch (error) {
    // Offline, blocked, or the service is down. The original is still on screen.
    return { ok: false, error: 'Could not reach the translation service.' }
  }
}

/*
  A different id each time one of these blocks is built.

  It lives here, not in TranslateText.vue, because everything inside
  <script setup> is re-run for every copy of the component - a counter
  declared there would reset to 0 on each card and hand them all the same id,
  which is exactly the bug it was meant to prevent. Module scope is counted
  once, when the file is first imported.
*/
let built = 0
export function nextSelectId() {
  built += 1
  return `translate-language-${built}`
}
