// GUIDE: browser-only sample data from before the move to Supabase.
// Accounts, help requests and earned points now live in Supabase, so `users`,
// seedPoints() and seedRequests() are no longer used by the app. Their ids
// ('s1', 'y1', ...) are not real Supabase user ids.
// Only seedLedger() is still used: stores/points.js starts its browser-only
// ledger (voucher spending and challenge bonuses) from it.
// New features: put sample data in Supabase (a SQL insert or a seed script),
// not here, so every teammate and every test sees the same rows.
import { calcPoints } from './points.js'

// Demo "accounts". There is no real login, you just pick one on the landing page.
export const users = [
  { id: 's1', name: 'Mdm Tan Siew Lan', role: 'senior', block: 'Blk 412 Eunos Cres' },
  { id: 's2', name: 'Mr Lim Ah Kow', role: 'senior', block: 'Blk 410 Eunos Cres' },
  { id: 's3', name: 'Mdm Fatimah', role: 'senior', block: 'Blk 415 Eunos Cres' },
  { id: 's4', name: 'Uncle Raj', role: 'senior', block: 'Blk 408 Eunos Cres' },
  { id: 'y1', name: 'Wei Jie', role: 'youth', block: 'Blk 405 Eunos Cres' },
  { id: 'y2', name: 'Aisha', role: 'youth', block: 'Blk 418 Eunos Cres' },
]

// Starting points for each youth
export function seedPoints() {
  return { y1: 120, y2: 200 }
}

// Build one sample request from the senior's id (looked up in users)
function sample(id, senior, title, description, category, difficulty, duration, status = 'open', helperId = null) {
  const owner = users.find((u) => u.id === senior)
  const helper = users.find((u) => u.id === helperId)
  return {
    id,
    title,
    description,
    category,
    difficulty,
    duration,
    points: calcPoints(difficulty, duration),
    seniorId: owner.id,
    seniorName: owner.name,
    block: owner.block,
    status,
    helperId,
    helperName: helper ? helper.name : null,
    createdAt: Date.now(),
  }
}

// Newest first
export function seedRequests() {
  return [
    sample('r1', 's1', 'Help me set up Singpass on my new phone',
      'My son bought me a new phone. I cannot log in to Singpass and I am afraid to press the wrong thing.',
      'Tech', 'Medium', 45),
    sample('r2', 's2', 'Buy groceries from Eunos market',
      'Need eggs, rice, cabbage and a bottle of soy sauce. I will pay you back in cash.',
      'Grocery', 'Easy', 30),
    sample('r3', 's3', 'Carry gas tank up to level 7',
      'The lift stops at level 5 for my block. The gas tank is too heavy for me.',
      'Lifting', 'Hard', 30),
    sample('r4', 's4', 'Explain a letter from CPF Board',
      'I received a letter and do not understand what I need to do. Mandarin or Malay is fine.',
      'Translation', 'Easy', 30),
    sample('r5', 's2', 'Morning walk around the estate garden',
      'Doctor says I should walk more but I do not like walking alone. Slow pace please.',
      'Companion Walk', 'Easy', 60),
    sample('r6', 's3', 'Collect my medicine from the pharmacy',
      'Prescription is ready at the Eunos pharmacy. I have a knee problem today.',
      'Grocery', 'Easy', 30),
    sample('r7', 's4', 'Install a video call app for my grandchildren',
      'I want to see my grandchildren overseas. Please teach me step by step.',
      'Tech', 'Hard', 60),
    sample('r8', 's1', 'Move a small cabinet to the bedroom',
      'Light cabinet, two people can carry it easily.',
      'Lifting', 'Medium', 30, 'completed', 'y2'),
  ]
}

// Starting points ledger
// y1 is Wei Jie, y2 is Aisha. inital points i put 120 and 200
// s3 is fatimah
export function seedLedger() {
  const day = 86400000
  return [
    { id: 'p1', userId: 'y1', amount: 120, reason: 'Starting balance', createdAt: Date.now() - day },
    { id: 'p2', userId: 'y2', amount: 200, reason: 'Starting balance', createdAt: Date.now() - day * 2 },
    { id: 'p5', userId: 's3', amount: 6400, reason: 'Community activity', createdAt: Date.now() - day * 5 },
  ]
}