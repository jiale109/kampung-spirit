# Kampung Spirit

> Neighbours helping neighbours, one small favour at a time.

IS216 group project (G6, Team 1). A web app for one HDB estate (Eunos) where seniors post help requests, youths nearby accept them, residents join hangouts and skill-swap sessions, and helpers earn points they can redeem for (simulated) vouchers from local merchants.

Built with Vue 3, Pinia, Vue Router and Bootstrap 5. Tested with Playwright. Deployed on Vercel.

**Current state:** the **Help Board** works end to end (with sample data saved in the browser). Hangouts, Skill Swaps, Rewards and Profile are empty placeholder pages with a step-by-step **GUIDE** comment at the top of each file, ready for the team to build.

## Quick start

You need [Node.js](https://nodejs.org/) 22 or newer and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # production build, run this before opening a pull request
pnpm test:e2e       # Playwright tests (starts the dev server itself)
```

First time running the tests? Run `npx playwright install chromium` once.

There is no real login yet. On the landing page, choose **Senior** or **Youth**, pick a demo account and press **Enter**.

## Team and who builds what

| Feature | Owner | Start here |
|---|---|---|
| Help Board (done, to be connected to the backend) | Victoria Soh | `stores/helpRequest.js` |
| Hotspot Hangouts | Lee Jia Le | `views/hangouts/HangoutsView.vue` |
| Skill-Swap Circles | Kelsey Wong | `views/skillswap/SkillSwapView.vue` |
| Points, Rewards and Community Challenge | Nathaniel Low | `views/rewards/RewardsView.vue` |
| Accounts and login (backend) | Reuben Tham | `stores/auth.js`, `views/LandingView.vue` |
| Profile pages, layout and theme | Clarence Tay | `views/profile/ProfileView.vue`, `layouts/` |

How we work in Git (branches, pull requests, who edits which file): see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Project structure

```
src/
  main.js                    Creates the app (Pinia, router, Bootstrap, theme)
  App.vue                    <router-view />
  styles/theme.css           All custom styling on top of Bootstrap (colours, text size, buttons, cards)
  router/index.js            All routes, the login/role guard, and sharedChildren (pages both roles see)
  stores/
    auth.js                  Who is logged in (demo login for now)
    helpRequest.js           Help requests and their rules (accept limit, confirm, points)
  layouts/
    SeniorViewsLayout.vue    Navbar for seniors (text is larger here)
    YouthViewsLayout.vue     Navbar for youths (shows points)
  views/
    LandingView.vue          Landing page + login
    senior/                  Help Board pages for seniors (list, create, edit)
    youth/                   Help Board pages for youths (board, my tasks)
    hangouts/                PLACEHOLDER  Hotspot Hangouts
    skillswap/               PLACEHOLDER  Skill-Swap Circles
    rewards/                 PLACEHOLDER  Points, Rewards, Community Challenge
    profile/                 PLACEHOLDER  Profile
  components/
    RequestCard.vue          A request: simple card, details on hover or tap
    RequestForm.vue          Create/edit form with validation
    CategoryBadge.vue  StatusBadge.vue  EmptyState.vue
  lib/
    points.js                Categories, difficulty, 2-task limit, points formula (placeholder)
    seed.js                  Demo accounts and sample data
e2e/                         Playwright tests (helpers.js + one spec per area)
```

Pages in the navbar: seniors see **My Requests, Hangouts, Skill Swaps, Rewards** and youths see **Help Board, My Tasks, Hangouts, Skill Swaps, Rewards**. **Profile** and **Log out** are in the name menu.

## Adding a feature (checklist)

1. Read the GUIDE comment at the top of your placeholder view.
2. Put the sample data in `lib/seed.js` as a `seedXxx()` function.
3. Make a store in `stores/` by copying the pattern in `stores/helpRequest.js`.
4. Build the page in your feature's folder under `views/`, and shared pieces in `components/`.
5. Need a new page? Add one line to `sharedChildren` in `router/index.js` (both roles get it) and, if it should be in the menu, a link in both files in `layouts/`.
6. Write an e2e test (copy `e2e/helpboard.spec.js`).
7. Run `pnpm build` and `pnpm test:e2e`, then open a pull request.

## Design rules for seniors

The users are seniors, so the design is deliberately calm and large.

- **Text size:** 18px on youth pages and the landing page, **22px on senior pages** (set in `styles/theme.css`, picked by the `.role-senior` wrapper in `SeniorViewsLayout.vue`). Everything is sized in `rem` so text, buttons and spacing grow together. Always use `rem`.
- **Simple by default:** request cards show only the category, status and title. The details and buttons open on mouse hover, or on tap, or with Enter on the keyboard (`components/RequestCard.vue`). Reuse this idea for other lists.
- **Big targets:** buttons and inputs are at least 48px tall, with one main action per screen.
- **Status in words:** colour is only a hint. States are always written ("Open", "Awaiting confirmation").
- **Colours and fonts** are variables at the top of `styles/theme.css`. Change `--ks-teal` to re-colour the whole app.
- Content sits in one column (920px max) so lines stay easy to read.

## Demo script (Help Board)

1. Landing page: choose **Senior** > Mdm Tan Siew Lan > **Enter**.
2. **+ Ask for Help**: submit empty (validation), then post a request. Hover a card to see its details, then edit and cancel it.
3. Log out (name menu), choose **Youth** > Wei Jie. Filter and sort the board. Accept 2 requests (the 3rd is blocked).
4. **My Tasks** > **Mark as done**. Points are NOT released yet.
5. Log out, log in as the senior who owns that request. The card is already open: **Yes, ... helped me**.
6. Log in as Wei Jie again: the points have gone up.

Request status flow: `open` > `accepted` > `pending_confirmation` > `completed` (or `cancelled`).

## Deploying

The repo is ready for [Vercel](https://vercel.com/): import it, keep the defaults (build command `pnpm build`, output `dist`). `vercel.json` sends every path to `index.html` so refreshing a page like `/senior/rewards` works.

## External APIs (planned)

| API | Used for | Who |
|---|---|---|
| OneMap search and map | Finding hotspots and showing them on a map | Hangouts |
| data.gov.sg 2-hour weather forecast | Rain warning for outdoor hangouts | Hangouts |

Exact endpoints and response shapes are written in `views/hangouts/HangoutsView.vue`. Keep any API keys in a `.env` file (git-ignored), never in the code.
