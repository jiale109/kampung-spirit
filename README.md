# Kampung Spirit

> Neighbours helping neighbours, one small favour at a time.

IS216 group project (G6, Team 1). A web app for one HDB estate (Eunos) where seniors post help requests, youths nearby accept them, residents join hangouts and skill-swap sessions, and helpers earn points they can redeem for (simulated) vouchers from local merchants.

Built with Vue 3, Pinia, Vue Router and Bootstrap 5. Tested with Playwright. Deployed on Vercel.

**Current state:** the **Help Board** works end to end with real accounts and data in [Supabase](https://supabase.com/) (database and login). There is no Express server. Hangouts, Skill Swaps, Rewards and Profile are empty placeholder pages with a step-by-step **GUIDE** comment at the top of each file, ready for the team to build.

## Quick start

You need [Node.js](https://nodejs.org/) 22 or newer and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # production build, run this before opening a pull request
pnpm test:e2e       # Playwright tests (starts the dev server itself)
```

First time running the tests? Run `npx playwright install chromium` once.

Login is real (Supabase Auth): sign up on the **Create an account** page, or log in with one of the [demo accounts](#demo-accounts). Seniors (65+) start on **My Requests**, everyone else on the **Help Board**. Nothing is saved in the browser except the login session.

## Supabase setup

1. Copy `.env.example` to `.env` and fill in your project's URL and publishable key. Restart `pnpm dev` after changing it.
2. **New, empty project:** in the Supabase dashboard open **SQL Editor > New query**, paste all of `supabase/schema.sql` and press **Run**. Switch off **Authentication > Email > Confirm email** while developing.
3. **Project that already has the schema:** run each file in `supabase/migrations/` that you have not run yet, oldest first, the same way. For example `20261020120000_add_needed_at.sql` adds the "When do you need help?" time to requests, and `20261024120000_rewards.sql` moves voucher spending and the wallet into Supabase. Every file in `supabase/migrations/` is safe to run again, so if you are not sure whether you ran one, run it.
4. Add the demo accounts, some open requests, and demo hangouts and skill swaps (some people already joined, one session full):
   ```bash
   pnpm seed:demo
   ```
   It is safe to run again: accounts that already exist are skipped, seniors who already have requests do not get more, and hosts who already have open hangouts or skill swaps do not get more.

The e2e tests sign up new `e2e-...@example.com` accounts every run, so point `.env` at a separate test project if you can.

### Demo accounts

All demo accounts use the password **`kampung-demo-123`**.

| Name | Email | Age group |
|---|---|---|
| Mdm Tan Siew Lan | `demo.tan@example.com` | Senior |
| Mr Lim Ah Kow | `demo.lim@example.com` | Senior |
| Mdm Fatimah | `demo.fatimah@example.com` | Senior |
| Wei Jie | `demo.weijie@example.com` | Youth |
| Aisha | `demo.aisha@example.com` | Youth |

## Team and who builds what

| Feature | Owner | Start here |
|---|---|---|
| Help Board (done, on Supabase) | Victoria Soh | `stores/helpRequest.js` |
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
    auth.js                  Sign up, log in and the logged-in person's profile (Supabase Auth)
    helpRequest.js           Help requests (Supabase) and the accept limit
    points.js                Your points balance and the community total (Supabase); the navbar reads it here
    wallet.js                Your redeemed vouchers (Supabase)
  layouts/
    MainLayout.vue           The one navbar for everyone (applies "Use large text" to <html>)
    SeniorViewsLayout.vue    NOT USED any more (replaced by MainLayout)
    YouthViewsLayout.vue     NOT USED any more (replaced by MainLayout)
  views/
    LandingView.vue          Landing page + login
    RegisterView.vue         Sign up
    senior/                  Help Board: My Requests (Active and Past), create, edit   /app/requests
    youth/                   Help Board: the board and My Tasks                        /app, /app/tasks
    hangouts/                PLACEHOLDER  Hotspot Hangouts
    skillswap/               PLACEHOLDER  Skill-Swap Circles
    rewards/                 PLACEHOLDER  Points, Rewards, Community Challenge
    profile/                 PLACEHOLDER  Profile
  components/
    RequestCard.vue          A request: simple card, details on hover or tap
    RequestForm.vue          Create/edit form with validation (including when help is needed)
    CategoryBadge.vue  StatusBadge.vue  EmptyState.vue
  lib/
    supabase.js              The one Supabase client (reads .env)
    points.js                Categories, difficulty, 2-task limit, points formula (placeholder)
supabase/
  schema.sql                 The whole database, for a new project
  migrations/                Changes to run on a project that already has the schema
scripts/
  seed-demo.js               pnpm seed:demo: demo accounts, open requests, hangouts and skill swaps
e2e/                         Playwright tests (helpers.js + one spec per area)
```

Pages in the navbar (the same for everyone, since anyone can ask for help and anyone can help): **My Requests, Help Board, My Tasks, Hangouts, Skill Swaps, Rewards**. **Profile** and **Log out** are in the name menu.

## Adding a feature (checklist)

1. Read the GUIDE comment at the top of your placeholder view.
2. Put sample data in Supabase (add it to `scripts/seed-demo.js`), so every teammate sees the same rows.
3. Make a store in `stores/` by copying the pattern in `stores/helpRequest.js`.
4. Build the page in your feature's folder under `views/`, and shared pieces in `components/`.
5. Need a new page? Add one line to `sharedChildren` in `router/index.js` (both roles get it) and, if it should be in the menu, a link in both files in `layouts/`.
6. Write an e2e test (copy `e2e/helpboard.spec.js`).
7. Run `pnpm build` and `pnpm test:e2e`, then open a pull request.

## Design rules for seniors

The users are seniors, so the design is deliberately calm and large.

- **Text size:** **22px for everyone**, and **27px when "Use large text" is on** (chosen at sign up or on the Profile page). The larger size is the `html.large-text` rule in `styles/theme.css`, applied by `MainLayout.vue` and `lib/profile.js`. Everything is sized in `rem` so text, buttons and spacing grow together. Always use `rem`.
- **Simple by default:** request cards show only the category, status and title. The details and buttons open on mouse hover, or on tap, or with Enter on the keyboard (`components/RequestCard.vue`). Reuse this idea for other lists.
- **Big targets:** buttons and inputs are at least 48px tall, with one main action per screen.
- **Status in words:** colour is only a hint. States are always written ("Open", "Awaiting confirmation").
- **Colours and fonts** are variables at the top of `styles/theme.css`. Change `--ks-teal` to re-colour the whole app.
- Content sits in one column (920px max) so lines stay easy to read.

## Demo script (Help Board)

Run `pnpm seed:demo` first (see [Supabase setup](#supabase-setup)). It also adds demo hangouts and skill swaps, so those pages are not empty.

1. Log in as Mdm Tan Siew Lan (`demo.tan@example.com`). You land on **My Requests**.
2. **+ Ask for Help**: submit empty (validation), then post a request with a time later this week. Hover a card to see its details and when help is needed, then edit and cancel it. The cancelled request moves to **Past**.
3. Log out (name menu) and log in as Wei Jie (`demo.weijie@example.com`). Filter and sort the board. Accept 2 requests (the 3rd is blocked).
4. **My Tasks** > **Mark as done**. Points are NOT released yet.
5. Log out, log in as the senior who owns that request. The card is already open: **Yes, ... helped me**. It moves to **Past**.
6. Log in as Wei Jie again: the points in the navbar have gone up.

Request status flow: `open` > `accepted` > `pending_confirmation` > `completed` (or `cancelled`).

## Deploying

The repo is ready for [Vercel](https://vercel.com/): import it, keep the defaults (build command `pnpm build`, output `dist`). `vercel.json` sends every path to `index.html` so refreshing a page like `/app/rewards` works. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under the project's Environment Variables.

## External APIs (planned)

| API | Used for | Who |
|---|---|---|
| OneMap search and map | Finding hotspots and showing them on a map | Hangouts |
| data.gov.sg 2-hour weather forecast | Rain warning for outdoor hangouts | Hangouts |

Exact endpoints and response shapes are written in `views/hangouts/HangoutsView.vue`. Keep any API keys in a `.env` file (git-ignored), never in the code.
