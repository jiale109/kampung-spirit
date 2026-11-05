# Kampung Spirit

> Neighbours helping neighbours, one small favour at a time.

Kampung Spirit is a web app for HDB estates all over Singapore. Seniors ask for everyday help, youths and other neighbours nearby take it on, residents meet at casual hangouts and teach each other in skill-swap sessions, and helpers earn points they can redeem for (simulated) vouchers from local merchants.

IS216 Web Application Development II, G6 Team 1.

## Quick links

| | |
|---|---|
| **Live application** | **https://kampung-spirit.vercel.app** (opens on the landing page, `/landing`) |
| **Git repository** | **https://github.com/jiale109/kampung-spirit** |
| **Demo login** | `demo.tan@example.com` / `kampung-demo-123` (all demo accounts are [below](#demo-accounts)) |


---

## Contents

1. [About](#about)
2. [Features](#features)
3. [Demo accounts](#demo-accounts)
4. [Tech stack](#tech-stack)
5. [External APIs](#external-apis)
6. [Getting started](#getting-started)
7. [Telegram notifications (optional)](#telegram-notifications-optional)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Project structure](#project-structure)
11. [Accessibility and design for seniors](#accessibility-and-design-for-seniors)
12. [Security](#security)
13. [Known limitations](#known-limitations)
14. [Credits](#credits)

---

## About

Many seniors in HDB estates live alone and need small, practical help: setting up Singpass on a new phone, carrying a gas tank up the stairs, understanding a letter from a government agency. Many younger residents live a few blocks away and would help if they knew. Kampung Spirit brings back the *kampung* spirit of looking out for one another by connecting the two, inside one familiar neighbourhood.

Anyone can ask for help and anyone can help. The app is designed first for seniors: large text, big buttons, plain words and one clear action per screen.

---

## Features

### Help Board
- **Ask for help** in one of six categories (Tech, Grocery, Lifting, Translation, Companion Walk, Other), with a calendar to pick the day, a time list, and a meeting place chosen on a map (OneMap search, tap the map, or "Use my address").
- **Help a neighbour** from the Help Board: filter by category, sort by points, time or date, and see requests as pins on a map.
- **Clear status flow:** Open → Accepted → Waiting for confirmation → Completed (or Cancelled), always written in words, never shown by colour alone.
- **Points are released only when the person who asked confirms** the help happened.
- **Fair-use rules:** a helper can have at most 2 active tasks; a person can post at most 3 requests a day; physical tasks ask the helper to confirm they are comfortable.
- **Reschedule, edit, cancel and delete** your own requests; past requests move to a "Past" section.

### Hotspot Hangouts
- Residents propose casual meet-ups (morning walks, kopi and newspapers, a herb-garden morning) at familiar estate spots or any place found on **OneMap**.
- A **map of hotspots**; press a marker or search a place to see hangouts near it.
- **Rain warning** for outdoor hangouts from the data.gov.sg 2-hour forecast, shown when a hangout is about to start.
- Join or leave with one button; the host marks it done after it starts, and everyone who came earns points.
- Hangouts are booked at least 24 hours ahead and last 30 minutes to 3 hours.

### Skill-Swap Circles
- Seniors and youths **host small sessions** to share what they know (crochet, digital-banking safety, kueh making, a language), with a date, time, venue, map pin and capacity (1 to 10).
- **Search, filter** (type, next 7 days, weekends) **and sort** sessions; "Full" sessions say so in words.
- After the session, the host **ticks who actually came**; the host and those people earn points.
- Sessions are booked at least 24 hours ahead.

### Rewards and Community Challenge
- Every completed help request, hangout and skill swap earns **Kampung Points**, worked out in the database from effort and duration.
- **Redeem points for vouchers** from local merchants (simulated for this project). Vouchers are kept in a personal **wallet** with a code to show at the counter, and can be marked as used.
- A **monthly community challenge** (10,000 points) with a live progress bar; when the community reaches it, every contributor that month receives a 50-point bonus, paid once by the database.

### Profile
- **Pixel-art avatar** built from age group, gender and skin tone, optionally **walking across the navbar**.
- **Interests** chosen from a list or typed in, a **large-text** setting, Telegram connection, and **delete my account**.
- Age group (youth 12–21, adult 22–64, senior 65+) is worked out from the date of birth, which only the user can see.

### Translation
- Cards can be read in **English, 中文, Melayu or தமிழ்**. Interface words use a fixed, checked table; what neighbours write is machine-translated (MyMemory). Names and addresses are never translated.

### Telegram notifications
- Link an account to the Kampung Spirit Telegram bot to get a message when a request is accepted, done or cancelled, when someone joins your hangout or session, and a reminder about a day before anything you are going to.

### Safety
- Requests cannot contain blocked phrases (for example asking a helper to keep secrets or come alone) or contact details; everyone is reminded never to share OTPs, passwords or bank details.
- **Under-18s** sign up with a parent or guardian's name, email and consent, cannot accept tasks until their guardian is verified, and cannot accept requests inside someone's home or before 8 am / from 7 pm.

### Admin
- An admin account sees every live help request, hangout and skill swap and can **delete** any of them. It cannot post, accept, host or join anything. The database enforces this, not just the screen.

---

## Demo accounts

All five resident accounts use the password **`kampung-demo-123`**.

| Name | Email | Age group | Good for showing |
|---|---|---|---|
| Mdm Tan Siew Lan | `demo.tan@example.com` | Senior (large text on) | Asking for help, confirming a task, hosting a hangout and a full skill swap |
| Mr Lim Ah Kow | `demo.lim@example.com` | Senior (large text on) | Asking for help, hosting a skill swap |
| Mdm Fatimah | `demo.fatimah@example.com` | Senior | Asking for help, hosting a hangout |
| Wei Jie | `demo.weijie@example.com` | Youth | Accepting and completing tasks, earning and redeeming points |
| Aisha | `demo.aisha@example.com` | Youth | Hosting a hangout and a skill swap |

---

## Tech stack

| Layer | Technology | Used for |
|---|---|---|
| Front end | [Vue 3](https://vuejs.org/) (`<script setup>`) | All pages and components |
| Build tool | [Vite 7](https://vite.dev/) | Development server and production build |
| State | [Pinia](https://pinia.vuejs.org/) | One store per feature (auth, help requests, hangouts, skill swaps, points, wallet) |
| Routing | [Vue Router 4](https://router.vuejs.org/) | Pages, login guard, admin-only rules |
| Styling | [Bootstrap 5](https://getbootstrap.com/) + our own `theme.css` | Layout, components, senior-friendly sizing |
| Maps | [Leaflet](https://leafletjs.com/) with OneMap tiles | Hotspot, request and session maps |
| HTTP | [axios](https://axios-http.com/) | Calls to OneMap, data.gov.sg and Edge Functions |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) | All data, with Row Level Security and database functions for every rule |
| Authentication | Supabase Auth | Sign up, log in, sessions |
| Server code | Supabase Edge Functions (Deno) + Cron | Telegram bot and hourly reminders |
| Hosting | [Vercel](https://vercel.com/) | Live site, deployed from `main` |
| Unit tests | [Vitest](https://vitest.dev/) | Pure logic in `src/lib/` |
| End-to-end tests | [Playwright](https://playwright.dev/) | Full user journeys in a real browser |
| Package manager | [pnpm](https://pnpm.io/) | Installing and running everything |

There is no separate Express or Node server: the browser talks to Supabase directly, and the database itself enforces every rule.

---

## External APIs

| API | Used for | Key needed |
|---|---|---|
| [OneMap](https://www.onemap.gov.sg/apidocs) (Singapore Land Authority) | Place search, turning a place into coordinates, and the map tiles | Optional (`VITE_ONEMAP_TOKEN`) |
| [data.gov.sg 2-hour weather forecast](https://data.gov.sg/) | Rain warning on outdoor hangouts | No |
| [MyMemory Translation](https://mymemory.translated.net/) | Translating what residents write into 中文, Melayu and தமிழ் | No |
| [Telegram Bot API](https://core.telegram.org/bots/api) | Notifications and reminders (through Supabase Edge Functions only) | Yes, kept as a Supabase secret |

If OneMap, data.gov.sg or MyMemory is unavailable, the app carries on without that extra (no map search, no rain warning or no translation) and never blocks the page.

---

## Getting started

These steps run the application from the submitted files on your own computer, against your own Supabase project.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) **22 or newer**
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- A free [Supabase](https://supabase.com/) account

### 2. Get the code and install

```bash
git clone https://github.com/jiale109/kampung-spirit.git
cd kampung-spirit
pnpm install
```

(If you have the submitted folder instead, open a terminal in it and run `pnpm install`.)

### 3. Create the database

1. In Supabase, create a **new project**.
2. Open **SQL Editor → New query**, paste the **whole of `supabase/schema.sql`** and press **Run**. This creates every table, rule and function.
3. Open **Authentication → Sign In / Providers → Email** and turn **Confirm email off**, so new accounts can log in straight away.

> Already have a project with an older version of the schema? Instead of `schema.sql`, run each file in `supabase/migrations/` that you have not run yet, **oldest first**. Every migration is safe to run again.

### 4. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase → Project Settings → API Keys (the **publishable** key, never the `service_role` key) |
| `VITE_ONEMAP_TOKEN` | No | Your OneMap account; place search works without it |
| `VITE_TELEGRAM_BOT_USERNAME` | No | Only for Telegram notifications (see below) |

`.env` is git-ignored and must never be committed.

### 5. Add the demo data

```bash
pnpm seed:demo
```

This creates the five demo residents, the admin account, open help requests, hangouts and skill swaps (all dated in the coming days) and some people who have joined them. It is safe to run again: existing accounts and people with upcoming items are skipped.

Then make the admin an admin, once, in **SQL Editor → New query** (the seed script prints this too):

```sql
insert into public.admins (user_id)
  select id from auth.users where email = 'admin@example.com'
  on conflict do nothing;
```

### 6. Run it

```bash
pnpm dev            # http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serves the production build locally |
| `pnpm test:unit` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright); see [Testing](#testing) |
| `pnpm seed:demo` | Demo accounts and data |

---

## Telegram notifications (optional)

The app works fully without this. To turn notifications on for your own Supabase project you need a bot from [@BotFather](https://t.me/BotFather), three Edge Function secrets, the Edge Functions deployed, seven Database Webhooks and one hourly Cron job. The full step-by-step guide is in **[`supabase/functions/README.md`](supabase/functions/README.md)**.

| Function | Triggered by | Does |
|---|---|---|
| `telegram-webhook` | Messages to the bot | `/start` links an account, `/stop` unlinks |
| `notify` | Database Webhooks | Messages when a request is accepted, withdrawn, done, confirmed or cancelled, and when someone joins or cancels a hangout or session |
| `send-reminders` | Cron, every hour | Reminders a day before, "nobody could help in time", and "please confirm" nudges |
| `telegram-account` | The Profile page | Sends a test message, or disconnects |

---

## Testing

**Unit tests** (no setup needed):

```bash
pnpm test:unit
```

**End-to-end tests** sign up real `e2e-…@example.com` accounts and create real data, so point `.env` at a **separate test Supabase project** (set up as in [step 3](#3-create-the-database)), not the live one:

```bash
npx playwright install chromium   # once
pnpm test:e2e                     # starts the dev server itself
```

To remove the test accounts and everything they created afterwards, run in that project's SQL Editor:

```sql
delete from auth.users where email like 'e2e-%@example.com';
```

---

## Deployment

The live site is hosted on **Vercel** and deploys automatically on every push to `main`.

1. Import the GitHub repository in Vercel. It detects Vite: build command `pnpm build`, output directory `dist`, Node.js 22.x.
2. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (and optionally `VITE_ONEMAP_TOKEN`, `VITE_TELEGRAM_BOT_USERNAME`) under **Settings → Environment Variables**.
3. In Supabase → **Authentication → URL Configuration**, set the Site URL to the Vercel address and add `https://<your-app>.vercel.app/**` to the Redirect URLs.

`vercel.json` sends every path to `index.html`, so refreshing on a page such as `/app/rewards` works.

---

## Project structure

```
kampung-spirit/
├── index.html
├── package.json             Scripts and dependencies
├── vercel.json              Single-page-app rewrite for Vercel
├── .env.example             Environment variables to copy into .env
├── public/images/           Avatars, merchant logos, icons, landing photos
├── src/
│   ├── main.js              Creates the app (Pinia, router, Bootstrap, theme)
│   ├── router/index.js      Routes, login guard and admin rules
│   ├── layouts/             MainLayout.vue: the navbar and page frame
│   ├── views/               One folder per feature: senior/ (My Requests),
│   │                        youth/ (Help Board, My Tasks), hangouts/,
│   │                        skillswap/, rewards/, profile/, plus landing,
│   │                        login and sign-up
│   ├── components/          Cards, forms, map, calendar, modals
│   ├── stores/              Pinia stores: auth, helpRequest, hangout,
│   │                        skillSwap, points, wallet
│   ├── lib/                 Supabase client, OneMap, weather, translation,
│   │                        points rules, vouchers, content rules
│   └── styles/theme.css     All custom styling on top of Bootstrap
├── supabase/
│   ├── schema.sql           The whole database, for a new project
│   ├── migrations/          Changes for an existing project, oldest first
│   └── functions/           Edge Functions for Telegram (with their own README)
├── scripts/
│   ├── seed-demo.js         pnpm seed:demo
│   └── demo-video-data.sql  Optional: items starting today, for a recording
└── e2e/                     Playwright tests (unit tests sit next to src/lib files)
```

---

## Accessibility and design for seniors

- **Text** is 22px by default and **27px with "Use large text"** (chosen at sign up or on the Profile page). Everything is sized in `rem`, so buttons and spacing grow with the text.
- **Big targets:** buttons and inputs are at least 48px tall, with one main action per screen.
- **Words, not colour alone:** every state is written ("Open", "Full", "Awaiting confirmation"), and the chosen day on the calendar is also written out underneath.
- **Calm screens:** cards show the title and status first, with details on hover, tap or Enter.
- **Keyboard and screen readers:** every control works with the keyboard and has a visible focus ring; decorative images are hidden from screen readers.
- **Reduced motion:** the landing slideshow and the walking avatar slow down or stop for people whose device asks for less motion, and the walker can be switched off.
- **Responsive:** checked from 320px phones to wide desktops, with large text on and off.

---

## Security

- **Row Level Security** on every table: people see open items and their own data only; birth dates and guardian details are visible only to their owner.
- **Every rule lives in the database.** Status changes, points, voucher redemption, joining, limits and admin actions all go through PostgreSQL functions that check the rules, so they cannot be bypassed from the browser. The browser can write only a small set of named columns.
- **Points cannot be faked:** only database functions can add to the points ledger, and voucher costs are read from the database, not the page.
- **Secrets stay out of the code:** the browser uses only Supabase's publishable key; the Telegram bot token and service keys live only in Supabase secrets.

---

## Known limitations

- **Vouchers are simulated.** Codes are generated by the app and are not accepted by real merchants. Merchant names and logos are used for illustration only.
- **The weather warning covers the next two hours only**, as that is the forecast data.gov.sg provides, so it appears on the day of an outdoor hangout, shortly before it starts.
- **Guardian verification is manual:** an admin marks an under-18 as verified in the database; there is no email link to the guardian yet.
- **Hangouts and skill swaps cannot be edited** after they are posted; the host can cancel and post again.
- **Translation** uses MyMemory's free daily allowance, so heavy use may pause translations until the next day.
- **The sample data is from one estate:** the demo accounts and sample events (`pnpm seed:demo`) are all in Eunos, although anyone in Singapore can sign up and post. The community challenge is one shared goal for everyone using the app, not one per estate.

---

## Credits

- Map tiles and place search: **[OneMap](https://www.onemap.gov.sg/)**, © Singapore Land Authority.
- Weather: **[data.gov.sg](https://data.gov.sg/)**, 2-hour weather forecast, National Environment Agency.
- Translation: **[MyMemory](https://mymemory.translated.net/)**.
- Merchant names and logos belong to their owners and are shown only to illustrate the simulated vouchers.
