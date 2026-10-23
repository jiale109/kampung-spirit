/*
  GUIDE (Owner: Nathaniel Low): shared settings and points rules.

  - categories, difficulties, durations, MAX_ACTIVE_TASKS: Help Board settings.
  - calcPoints(): help request points. The database has its own copy
    (public.calc_points in supabase/schema.sql) and that one decides the real
    points. The copy here is only for the preview in RequestForm.vue. If you
    change the formula, change BOTH, or the preview will not match.
  - pointsForHangout() and pointsForSkillSwap(): rules for the other features.
    Points can only be added to points_ledger by a database function, so the
    Hangouts and Skill Swaps functions must use the same formula in SQL.
  - COMMUNITY_TARGET and COMMUNITY_BONUS: the monthly challenge
    (used by stores/points.js and views/rewards/RewardsView.vue).
*/
// Settings for help requests, and the (placeholder) points rule.

export const categories = [
  { name: 'Tech', icon: '📱' },
  { name: 'Grocery', icon: '🛒' },
  { name: 'Lifting', icon: '📦' },
  { name: 'Translation', icon: '🗣️' },
  { name: 'Companion Walk', icon: '🚶' },
]

// "Companion Walk" -> "cat-companion-walk" (used by theme.css to colour each category)
export function categoryClass(name) {
  return 'cat-' + name.toLowerCase().replace(/\s+/g, '-')
}

// Harder tasks are worth more points
export const difficulties = { Easy: 1, Medium: 2, Hard: 3 }

// Estimated time choices, in minutes
export const durations = [15, 30, 45, 60, 90, 120]

// A youth can only have this many active tasks at once
// Must match the limit in accept_help_request() in supabase/schema.sql
export const MAX_ACTIVE_TASKS = 2

// points = 10 x difficulty x (minutes / 30)
// e.g. Medium, 45 min -> 10 x 2 x 1.5 = 30 points
export function calcPoints(difficulty, duration) {
  return Math.round(10 * difficulties[difficulty] * (duration / 30))
}

// Hangout attendance or hosting (e.g. 60 mins base = 20 points)
export function pointsForHangout(durationMinutes = 60) {
  return Math.round(20 * (durationMinutes / 60))
}

// Skill swap teaching or participation (e.g. 60 mins base = 30 points)
export function pointsForSkillSwap(durationMinutes = 60) {
  return Math.round(30 * (durationMinutes / 60))
}
// Monthly community challenge target 
export const COMMUNITY_TARGET = 10000
export const COMMUNITY_BONUS = 50