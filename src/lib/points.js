/*
  GUIDE (Owner: Nathaniel Low): this file holds the settings and the PLACEHOLDER
  points rule for help requests. Change calcPoints() here when the team agrees
  the real formula. Add rules for hangouts and skill swaps below it, and the
  COMMUNITY_TARGET for the monthly challenge. See views/rewards/RewardsView.vue.
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
export const MAX_ACTIVE_TASKS = 2

// points = 10 x difficulty x (minutes / 30)
// e.g. Medium, 45 min -> 10 x 2 x 1.5 = 30 points
export function calcPoints(difficulty, duration) {
  return Math.round(10 * difficulties[difficulty] * (duration / 30))
}
