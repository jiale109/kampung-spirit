/*
  GUIDE (Owner: Clarence Tay): every translation in the app comes from here.

  TWO JOBS, TWO METHODS - this is the important part of this file
  A card has two kinds of words in it, and they need opposite treatment.

  1. WHAT A NEIGHBOUR WROTE - the title and description of a request, hangout
     or skill swap. Nobody knows what someone will type, so only a machine can
     do these. They go to MyMemory, through translate() below.

  2. THE INTERFACE - "Meeting place", "View map", "Time needed", "Easy". The
     same handful of phrases forever. These come from the UI table below and
     never touch the network, for three reasons:
       - cost. The interface is about 80% of the words on a card, and it is
         identical on every card. Sending it would spend the daily allowance
         re-translating "View map" over and over.
       - steadiness. MyMemory can word the same phrase differently between
         calls, so the same button would read differently on two cards.
       - safety. A machine's guess at a two-word button is exactly what an
         elderly resident cannot afford to misread. "Medium effort" guessed
         wrong is a confused neighbour; "View map" guessed wrong is one who
         cannot find the flat.

  WHAT IS NEVER TRANSLATED
  Addresses and people's names. "Blk 412 Eunos Cres" is where a helper
  physically walks, and MyMemory will happily turn "Blk" into something else.
  Names are names. Both stay in English in every language.

  WHY MyMemory
  It needs no API key, and it allows calls straight from the browser (CORS),
  so there is no server to run and no secret to leak. A Vue app ships its
  source to the browser, so a key in .env would be readable by anyone who
  opens the developer tools - which is worth remembering about
  VITE_ONEMAP_TOKEN too.

  THE FREE ALLOWANCE, AND WHAT THE EMAIL BELOW DOES
  MyMemory counts CHARACTERS a day - not words, and not calls.

    without an email    5,000 a day, counted per IP address
    with an email      50,000 a day, counted against that email

  Those are two different shapes, not just two numbers. Anonymous, every
  visitor has their own 5,000, so the app as a whole never runs out - the
  next resident starts fresh. With the email, everyone draws on ONE 50,000:
  ten times the allowance, shared between all of them.

  For this project - a few users, often on the same campus network, where
  anonymous would have us sharing one allowance anyway - the email is the
  better trade. If this ever had real residents on it, take the email out:
  per-visitor is the one that scales.

  The cache below matters either way: without it, every re-render of a list
  would spend the allowance again on words it has already translated.

  Docs: https://mymemory.translated.net/doc/spec.php

  THE LIMITATION, SAID OUT LOUD
  Every call says the original is English (FROM below). That is true of
  everything in the app today, and it covers the case this was built for: a
  resident who reads Chinese, Malay or Tamil opening a post written in
  English. Going the other way - a senior writing in Mandarin for a youth to
  read - needs the source changed, which is the third argument to translate().
*/
import { ref } from 'vue'
import axios from 'axios'
import { formatNeededAt } from '../stores/helpRequest.js'

const ENDPOINT = 'https://api.mymemory.translated.net/get'

// What the app's posts are written in today
const FROM = 'en'

/*
  Raises the daily allowance from 5,000 characters to 50,000. See the note at
  the top for what it costs: the allowance stops being per-visitor and
  becomes one pool shared by everybody using the app.

  This is not a secret and it is not treated as one. A Vue app ships its
  source to the browser, so this address is readable in the bundle and sits
  in the query string of every translation request - anyone who opens the
  network tab will see it. It is here deliberately, as a public contact
  address for the project, which is what MyMemory asks the parameter for.
  Delete the line to go back to anonymous; nothing else needs changing.
*/
const CONTACT = 'clarencetay.c@gmail.com'

/*
  The four languages of Singapore. The label is in the language itself, so
  someone looking for their own language recognises it without reading
  English first. '' is English, the language the posts are written in.
*/
export const LANGUAGES = [
  { code: '', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ms', label: 'Melayu' },
  { code: 'ta', label: 'தமிழ்' },
]

/*
  The language the whole app is being read in right now.

  One ref at module scope, so it is shared: every component that imports it
  reads the same value, and when it changes every one of them re-renders.
  That is what makes a single tap switch the interface everywhere at once
  rather than one card at a time.

  It is a plain ref rather than a store because nothing else needs to happen
  when it changes - no loading, no saving, no server.
*/
export const chosenLanguage = ref('')

export function setLanguage(code) {
  chosenLanguage.value = code
}

/*
  THE INTERFACE TABLE

  English on the left, because that keeps the templates readable: t('View map')
  says what it draws even if you do not speak the other three. A phrase with
  no entry falls through to English rather than breaking, so a half-finished
  row shows English instead of a blank.

  {n} is filled in by t() - see below.

  ---------------------------------------------------------------------------
  THESE NEED A HUMAN CHECK BEFORE THE DEMO. They were written to be correct
  and natural, but the whole argument above is that a machine should not be
  trusted with button labels, and the same caution applies to how these got
  here. Anyone in the group who speaks one of these languages should read
  their column. The Tamil especially.
  ---------------------------------------------------------------------------
*/
const UI = {
  // The stats line
  pts: { 'zh-CN': '分', ms: 'mata', ta: 'புள்ளிகள்' },
  min: { 'zh-CN': '分钟', ms: 'min', ta: 'நிமிடம்' },
  effort: { 'zh-CN': '难度', ms: 'usaha', ta: 'முயற்சி' },

  // Difficulty, as stored in the database
  Easy: { 'zh-CN': '简单', ms: 'Mudah', ta: 'எளிது' },
  Medium: { 'zh-CN': '中等', ms: 'Sederhana', ta: 'நடுத்தரம்' },
  Hard: { 'zh-CN': '困难', ms: 'Sukar', ta: 'கடினம்' },

  // Opening and closing the card
  'Show details': { 'zh-CN': '查看详情', ms: 'Lihat butiran', ta: 'விவரங்களைக் காட்டு' },
  'Click to keep open': {
    'zh-CN': '点击保持展开',
    ms: 'Klik untuk kekal terbuka',
    ta: 'திறந்தே வைக்க கிளிக் செய்க',
  },
  'Hide details': { 'zh-CN': '收起详情', ms: 'Sembunyikan butiran', ta: 'விவரங்களை மறை' },

  'Waiting for a helper for {n} days': {
    'zh-CN': '已等待帮手 {n} 天',
    ms: 'Menunggu penolong selama {n} hari',
    ta: '{n} நாட்களாக உதவியாளருக்காகக் காத்திருக்கிறது',
  },

  // The details
  'Meeting place:': { 'zh-CN': '见面地点：', ms: 'Tempat bertemu:', ta: 'சந்திக்கும் இடம்:' },
  'View map': { 'zh-CN': '查看地图', ms: 'Lihat peta', ta: 'வரைபடத்தைக் காண்க' },
  "At the requester's home": {
    'zh-CN': '在求助者家中',
    ms: 'Di rumah pemohon',
    ta: 'கோரியவரின் வீட்டில்',
  },
  'At your home': { 'zh-CN': '在您家中', ms: 'Di rumah anda', ta: 'உங்கள் வீட்டில்' },

  'Time needed': { 'zh-CN': '所需时间', ms: 'Masa diperlukan', ta: 'தேவையான நேரம்' },
  minutes: { 'zh-CN': '分钟', ms: 'minit', ta: 'நிமிடங்கள்' },
  Effort: { 'zh-CN': '难度', ms: 'Usaha', ta: 'முயற்சி' },
  Reward: { 'zh-CN': '奖励', ms: 'Ganjaran', ta: 'வெகுமதி' },
  points: { 'zh-CN': '分', ms: 'mata', ta: 'புள்ளிகள்' },
  'Helper:': { 'zh-CN': '帮手：', ms: 'Penolong:', ta: 'உதவியாளர்:' },

  // The progress steps
  Posted: { 'zh-CN': '已发布', ms: 'Dihantar', ta: 'வெளியிடப்பட்டது' },
  Accepted: { 'zh-CN': '已接受', ms: 'Diterima', ta: 'ஏற்கப்பட்டது' },
  Done: { 'zh-CN': '已完成', ms: 'Selesai', ta: 'முடிந்தது' },
  Confirmed: { 'zh-CN': '已确认', ms: 'Disahkan', ta: 'உறுதிப்படுத்தப்பட்டது' },

  // The categories
  Tech: { 'zh-CN': '科技', ms: 'Teknologi', ta: 'தொழில்நுட்பம்' },
  Grocery: { 'zh-CN': '买菜', ms: 'Barang runcit', ta: 'மளிகை' },
  Lifting: { 'zh-CN': '搬运', ms: 'Mengangkat', ta: 'தூக்குதல்' },
  Translation: { 'zh-CN': '翻译', ms: 'Terjemahan', ta: 'மொழிபெயர்ப்பு' },
  'Companion Walk': { 'zh-CN': '陪同散步', ms: 'Teman berjalan', ta: 'உடன் நடை' },

  // Hangout and skill-swap cards
  Day: { 'zh-CN': '日期', ms: 'Hari', ta: 'நாள்' },
  Time: { 'zh-CN': '时间', ms: 'Masa', ta: 'நேரம்' },
  Where: { 'zh-CN': '地点', ms: 'Tempat', ta: 'இடம்' },
  Going: { 'zh-CN': '参加人数', ms: 'Hadir', ta: 'வருபவர்கள்' },
  Spots: { 'zh-CN': '名额', ms: 'Tempat kosong', ta: 'இடங்கள்' },
  'Hosted by': { 'zh-CN': '主办者', ms: 'Dihoskan oleh', ta: 'நடத்துபவர்' },
  you: { 'zh-CN': '您', ms: 'anda', ta: 'நீங்கள்' },
  'Tap for details': { 'zh-CN': '点击查看详情', ms: 'Ketik untuk butiran', ta: 'விவரங்களுக்குத் தட்டவும்' },
  outdoors: { 'zh-CN': '户外', ms: 'di luar', ta: 'வெளியில்' },

  // How many are coming
  '1 person going': { 'zh-CN': '1 人参加', ms: '1 orang hadir', ta: '1 நபர் வருகிறார்' },
  '{n} people going': { 'zh-CN': '{n} 人参加', ms: '{n} orang hadir', ta: '{n} நபர்கள் வருகின்றனர்' },
  '1 spot left': { 'zh-CN': '剩 1 个名额', ms: '1 tempat lagi', ta: '1 இடம் உள்ளது' },
  '{n} spots left': { 'zh-CN': '剩 {n} 个名额', ms: '{n} tempat lagi', ta: '{n} இடங்கள் உள்ளன' },
  'No spots left': { 'zh-CN': '名额已满', ms: 'Tiada tempat kosong', ta: 'இடம் இல்லை' },

  // Status pills
  'Open to join': { 'zh-CN': '可报名', ms: 'Terbuka untuk sertai', ta: 'சேர திறந்துள்ளது' },
  'You are going': { 'zh-CN': '您已报名', ms: 'Anda akan hadir', ta: 'நீங்கள் வருகிறீர்கள்' },
  'You are hosting': { 'zh-CN': '您是主办者', ms: 'Anda menghoskan', ta: 'நீங்கள் நடத்துகிறீர்கள்' },
  'Waiting for you to mark as done': {
    'zh-CN': '等待您标记为完成',
    ms: 'Menunggu anda menandakan selesai',
    ta: 'முடிந்ததெனக் குறிக்க உங்களுக்காகக் காத்திருக்கிறது',
  },
  Full: { 'zh-CN': '已满', ms: 'Penuh', ta: 'நிரம்பிவிட்டது' },

  // Buttons on those cards
  'I am coming': { 'zh-CN': '我要参加', ms: 'Saya akan datang', ta: 'நான் வருகிறேன்' },
  'I cannot make it': { 'zh-CN': '我无法参加', ms: 'Saya tidak dapat hadir', ta: 'என்னால் வர முடியாது' },
  'Mark as done': { 'zh-CN': '标记为完成', ms: 'Tandakan selesai', ta: 'முடிந்ததெனக் குறி' },
  'Cancel this hangout': { 'zh-CN': '取消此活动', ms: 'Batalkan perjumpaan ini', ta: 'இந்தச் சந்திப்பை ரத்துசெய்' },
  'Join this session': { 'zh-CN': '报名此课程', ms: 'Sertai sesi ini', ta: 'இந்த அமர்வில் சேர்' },
  'Cancel my place': { 'zh-CN': '取消我的名额', ms: 'Batalkan tempat saya', ta: 'என் இடத்தை ரத்துசெய்' },
  'Session full': { 'zh-CN': '名额已满', ms: 'Sesi penuh', ta: 'அமர்வு நிரம்பிவிட்டது' },
  'Mark as completed': { 'zh-CN': '标记为完成', ms: 'Tandakan selesai', ta: 'முடிந்ததெனக் குறி' },
  'Cancel this session': { 'zh-CN': '取消此课程', ms: 'Batalkan sesi ini', ta: 'இந்த அமர்வை ரத்துசெய்' },
  'You can mark this as done once it has started.': {
    'zh-CN': '活动开始后即可标记为完成。',
    ms: 'Anda boleh menandakan ini selesai setelah ia bermula.',
    ta: 'இது தொடங்கியதும் முடிந்ததெனக் குறிக்கலாம்.',
  },
  'All places are taken. Look out for the next session from this host.': {
    'zh-CN': '名额已满。请留意该主办者的下一场课程。',
    ms: 'Semua tempat telah diisi. Nantikan sesi seterusnya daripada hos ini.',
    ta: 'அனைத்து இடங்களும் நிரம்பிவிட்டன. இந்த நடத்துபவரின் அடுத்த அமர்வை எதிர்பாருங்கள்.',
  },

  // The language bar itself
  'Read this in': { 'zh-CN': '阅读语言', ms: 'Baca dalam', ta: 'படிக்கவும்' },
  'Translating…': { 'zh-CN': '翻译中…', ms: 'Menterjemah…', ta: 'மொழிபெயர்க்கிறது…' },
  'Translated by machine. The words above are the original.': {
    'zh-CN': '由机器翻译。以上为原文。',
    ms: 'Diterjemah oleh mesin. Teks asal di atas.',
    ta: 'இயந்திரம் மொழிபெயர்த்தது. மேலே உள்ளது மூலம்.',
  },
  'This part could not be translated, so the original is shown.': {
    'zh-CN': '此部分无法翻译，显示原文。',
    ms: 'Bahagian ini tidak dapat diterjemah, teks asal ditunjukkan.',
    ta: 'இந்தப் பகுதியை மொழிபெயர்க்க முடியவில்லை, மூலம் காட்டப்படுகிறது.',
  },
}

/*
  Look up one interface phrase in the language being read right now.

  Reading chosenLanguage.value inside here is what makes it reactive: a
  template that calls t('View map') re-runs this when the language changes,
  so the whole interface switches without a watcher.

  vars fills in {n} and friends: t('Waiting for a helper for {n} days', { n: 8 })
*/
export function t(phrase, vars) {
  const code = chosenLanguage.value
  let out = (code && UI[phrase]?.[code]) || phrase
  if (vars) {
    for (const name of Object.keys(vars)) out = out.replace(`{${name}}`, vars[name])
  }
  return out
}

/*
  A date in the language being read.

  ENGLISH IS NOT FORMATTED HERE. It is handed straight to formatNeededAt,
  the app's own formatter, because this function must not change how a date
  looks to someone who never touches the language bar.

  It did, briefly, and a test caught it. toLocaleString('en-SG') writes
  "Sun, 8 Nov, 3:00 pm" where formatNeededAt writes "Sun 8 Nov, 3:00 PM" -
  a comma after the weekday and a lowercase am/pm. Small on paper, but it
  was every date on every card, and the uppercase PM is easier to pick out
  at a glance, which is the whole point for the people this app is for.

  The other three languages DO go to the browser, which already knows that
  Chinese puts the month first and that Malay says PG for the morning. That
  is a table of month and day names in three scripts that nobody has to
  write or keep correct.
*/
const LOCALES = { 'zh-CN': 'zh-CN', ms: 'ms', ta: 'ta' }

export function formatWhen(ms) {
  const locale = LOCALES[chosenLanguage.value]
  if (!locale) return formatNeededAt(ms)

  return new Date(ms).toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

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
      params: { q: original, langpair: `${from}|${to}`, de: CONTACT },
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
