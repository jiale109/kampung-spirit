# Contributing

How we work together on Kampung Spirit. Keep it simple: small branches, small pull requests, pull often.

## 1. Get set up

```bash
git clone <repo-url>
cd kampung-spirit
pnpm install
pnpm dev          # http://localhost:5173
```

Use **pnpm** only. Do not commit `package-lock.json` (it is git-ignored). If you add a package, run `pnpm add <name>` and commit the changed `pnpm-lock.yaml` and `package.json`.

## 2. Branches and pull requests

- `main` always works. Nobody pushes to it directly.
- One branch per piece of work, named `<feature>/<what>`:
  `hangouts/propose-form`, `rewards/voucher-store`, `profile/edit-interests`, `fix/card-focus-ring`.
- Commit small and often, with a message that says what changed:
  `Add hangout list filtered by hotspot`, not `update`.
- Open a pull request into `main` when a piece works. Fill in the template, and ask one teammate to review.
- Before you open it:
  ```bash
  git pull origin main --rebase   # bring in your teammates' work first
  pnpm build
  pnpm test:e2e
  ```
- Merge your own PR only after it was reviewed and the checks above pass. Delete the branch after merging.

## 3. Who owns what

Stay inside your own feature folder when you can. That way we rarely edit the same file.

| Feature | Owner | Your files |
|---|---|---|
| Help Board | Victoria Soh | `views/senior/*`, `views/youth/*`, `components/Request*.vue`, `stores/helpRequest.js` |
| Hotspot Hangouts | Lee Jia Le | `views/hangouts/*` (+ new `stores/hangout.js`, `lib/hotspots.js`, `lib/weather.js`) |
| Skill-Swap Circles | Kelsey Wong | `views/skillswap/*` (+ new `stores/skillSwap.js`) |
| Points, Rewards, Challenge | Nathaniel Low | `views/rewards/*`, `lib/points.js` (+ new `stores/points.js`, `stores/wallet.js`) |
| Accounts and login (backend) | Reuben Tham | `stores/auth.js`, `views/LandingView.vue` |
| Profile pages, layout and theme | Clarence Tay | `views/profile/*`, `layouts/*`, `styles/theme.css` |

Each placeholder page starts with a **GUIDE** comment that explains what to build and in what order. Read it first.

### Files everyone touches (be careful)

| File | Rule |
|---|---|
| `router/index.js` | Add your route as ONE line in `sharedChildren` (or the role's `children`). Do not reformat the file. |
| `scripts/seed-demo.js` | Add your own sample rows. Do not change another feature's sample data. |
| `styles/theme.css` | Prefer a `<style scoped>` block in your own component. Only put something here if 2+ features need it, and add it under the right numbered section. |
| `layouts/*` | Only the navbar links. Tell Clarence before changing the structure. |

If you get a merge conflict, do not guess: ask the person who owns the file.

## 4. Code style

- Vue 3 with `<script setup>`. Stores are **setup stores** (see `stores/helpRequest.js`).
- Use relative imports (`'../stores/auth.js'`), like the exemplar project.
- Short, readable code beats clever code. Write a comment when the *why* is not obvious.
- Words on screen: plain, short, sentence case ("Ask for help"). A button says exactly what it does ("Post request"), and keeps the same name everywhere.
- Actions that can fail return `{ ok: true }` or `{ ok: false, error: 'Plain message' }`, and the page shows the message.

## 5. Senior-friendly rules (every page must follow these)

1. Text is **22px** for everyone, and **27px** when "Use large text" is on (sign up or Profile page; `html.large-text` in `theme.css`, applied by `MainLayout.vue` and `lib/profile.js`). Everything is sized in `rem`, so use `rem` too, never `px` for text, padding or button size.
2. Buttons and inputs are at least 48px tall. One clear main action per screen.
3. Never show a state by colour alone. Write it ("Open", "Full", "Awaiting confirmation").
4. Keep screens calm: show the title and status first, and put details behind hover or tap (see `components/RequestCard.vue`).
5. Every control must work with the keyboard and show a visible focus ring.
6. Errors say what went wrong and how to fix it, without blame ("Write at least 5 characters.").
7. Check your page on a phone width (about 390px) and at senior text size before opening a PR.

## 6. Tests

Playwright tests live in `e2e/`. Copy `e2e/helpboard.spec.js` for your feature.

```bash
pnpm test:e2e                  # run all tests (starts the dev server for you)
npx playwright test hangouts   # run one file
```

Useful helpers are in `e2e/helpers.js`: `resetApp`, `login`, `logout`, `card`, `openCard`.
Request cards only show their buttons on hover, so use `openCard()` before clicking a button inside one.
If Playwright says a browser is missing, run `npx playwright install chromium` once.
