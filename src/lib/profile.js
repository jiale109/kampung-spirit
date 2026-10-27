/*
  GUIDE (Owner: Clarence Tay): the fixed list of interests for the profile page.

  interests is a text[] column on public.profiles, and a user may change only
  their own row (supabase/schema.sql, section 2). The list is fixed so that
  two neighbours who like the same thing save the same text. If people typed
  their own, we would end up with "Gardening", "gardening" and "garden" for
  one interest and could never match neighbours on it.

  Each entry is saved into the database exactly as written here. Add new
  interests freely. Do NOT rename an existing one without also updating the
  rows that already use it, or those profiles lose that interest.

  People may also add an interest of their own on the profile page, for
  anything this list has missed. tidyInterest() below keeps that from undoing
  the matching the fixed list is for.
*/
export const interests = [
  'Gardening',
  'Cooking',
  'Morning walks',
  'Kopi and chats',
  'Technology',
  'Photography',
  'Crafts',
  'Music',
  'Board games',
  'Exercise',
]

/*
  THE AVATAR
  ----------
  The sprite beside someone's details is one of the 24 pictures in
  public/images, named {age group}-{gender}-{skin tone}.svg, for example
  'senior-female-dark-brown.svg'. age_group comes from the birth date and
  cannot be changed; gender and skin_tone are the resident's own choice and
  live on their profile row (supabase/schema.sql, section 13).

  The value strings ARE part of the file name, so renaming one here without
  renaming the files gives everyone a broken picture. The same lists are
  checked by the database.
*/

// Shown as two boxes to press
export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

/*
  Shown as a slider, lightest on the left. The swatch colours are read
  straight out of the artwork, so the dot under the slider is the exact colour
  of the skin in the picture it chooses.
*/
export const SKIN_TONES = [
  { value: 'light', label: 'Light', swatch: '#E9AE83' },
  { value: 'brown', label: 'Brown', swatch: '#B87959' },
  { value: 'dark-brown', label: 'Dark brown', swatch: '#8E6047' },
  { value: 'darkest', label: 'Darkest', swatch: '#603F36' },
]

/*
  The picture for one person, or '' when they have not chosen a look yet.
  Returning '' rather than guessing matters: there is no neutral drawing to
  fall back on, and picking a gender on someone's behalf is not ours to do.
*/
export function avatarSrc(ageGroup, gender, skinTone) {
  const knownAge = ageGroup === 'youth' || ageGroup === 'adult' || ageGroup === 'senior'
  const knownGender = GENDERS.some((g) => g.value === gender)
  const knownTone = SKIN_TONES.some((t) => t.value === skinTone)
  if (!knownAge || !knownGender || !knownTone) return ''
  return `/images/${ageGroup}-${gender}-${skinTone}.svg`
}

/*
  The second frame of the walk: the same person mid-stride. Frame one is the
  ordinary avatar above, so a walk is the two swapped back and forth.
  Returns '' whenever avatarSrc() does, and the walker is then not drawn.
*/
export function avatarWalkSrc(ageGroup, gender, skinTone) {
  const still = avatarSrc(ageGroup, gender, skinTone)
  return still === '' ? '' : still.replace('.svg', '-walk.svg')
}

/*
  Where a tone sits on the slider, and which tone a slider position means.
  The slider works in whole numbers, 0 to 3, because <input type="range">
  gives back numbers rather than words.
*/
export function toneIndex(skinTone) {
  const found = SKIN_TONES.findIndex((t) => t.value === skinTone)
  return found === -1 ? 0 : found
}

export function toneAt(index) {
  const tone = SKIN_TONES[index]
  return tone ? tone.value : SKIN_TONES[0].value
}

/*
  "Use large text". theme.css gives everyone 22px and html.large-text raises
  that to 27px, so this only ever makes text bigger, never smaller. The class
  must go on the <html> element because every size in theme.css is in rem,
  and rem is measured from the html font-size.

  Called by MainLayout.vue when a logged-in page opens or closes, and by
  ProfileView.vue right after the setting is saved so the change shows at once.
*/
/*
  The longest interest someone may type. Long enough for 'Mahjong on Sundays',
  short enough to still fit on a tile at 27px text.
*/
export const MAX_INTEREST_LENGTH = 30

/*
  Tidy up an interest someone typed in, so a hand-typed one still matches a
  neighbour who picked the same thing from the list above.

    'gardening'  -> 'Gardening'   (already on the list, so it snaps to it)
    'GARDENING'  -> 'Gardening'
    'mahjong  club ' -> 'Mahjong club'   (new, so only the spaces are tidied)

  This is the answer to the worry at the top of this file: typing your own no
  longer splits one interest into three spellings. Anything genuinely new
  keeps the person's own words, with only the first letter raised, because we
  cannot know how they meant to capitalise 'kopi' or 'mahjong'.

  Returns '' for anything blank, which the caller treats as nothing typed.
*/
export function tidyInterest(text) {
  const words = String(text || '').trim().split(' ').filter((word) => word !== '')
  const clean = words.join(' ')
  if (clean === '') return ''

  const known = interests.find((name) => name.toLowerCase() === clean.toLowerCase())
  if (known) return known

  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export function applyLargeText(on) {
  if (on === true) {
    document.documentElement.classList.add('large-text')
  } else {
    document.documentElement.classList.remove('large-text')
  }
}
