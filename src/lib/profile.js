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
