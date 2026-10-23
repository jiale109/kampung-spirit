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
export function applyLargeText(on) {
  if (on === true) {
    document.documentElement.classList.add('large-text')
  } else {
    document.documentElement.classList.remove('large-text')
  }
}
