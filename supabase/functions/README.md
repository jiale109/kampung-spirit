# Edge Functions: Telegram notifications

Small JavaScript programs that run on Supabase (on Deno, not in the browser). They are
the only place that talks to Telegram, because the bot token must stay secret.

| Function | Called by | Does |
|---|---|---|
| `telegram-webhook` | Telegram, when someone messages the bot | `/start <code>` links an account, `/stop` unlinks, `/help` explains |
| `notify` | Database Webhooks (7 of them, below) | Sends a message when a request is accepted, withdrawn, done, confirmed or cancelled; when someone joins your skill swap or hangout; when one you joined is cancelled |
| `send-reminders` | A Supabase Cron job, every hour | One reminder about a day before each skill swap and hangout, to everyone going |
| `telegram-account` | The Profile page (axios) | `POST` sends a test message, `DELETE` disconnects |
| `_shared/telegram.js` | The four above | Sending messages, looking up names, date formatting |

The database part (tables `telegram_links` and `telegram_link_codes`, the
function `create_telegram_link_code()`, and `reminder_sent_at` columns) is
section 14 of `supabase/schema.sql`, or
`supabase/migrations/20261026120000_telegram.sql` for an existing project.

## Setup (once per Supabase project)

### 1. Secrets
Supabase dashboard → **Edge Functions → Secrets**:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | a random string (`openssl rand -hex 32`) |
| `NOTIFY_SECRET` | another random string (`openssl rand -hex 32`) |
| `APP_URL` | optional: the live site, e.g. `https://kampung-spirit.vercel.app`, so messages link back |

Never put these in the app, `.env` or git. In `.env` (and Vercel) only add the
bot's username, which is not secret: `VITE_TELEGRAM_BOT_USERNAME=KampungSpirit_Bot`.

### 2. Database
SQL Editor → run `supabase/migrations/20261026120000_telegram.sql`.

### 3. Deploy the functions
```bash
brew install supabase/tap/supabase      # once
supabase login                          # once
supabase link --project-ref <ref>       # once; <ref> is the part before .supabase.co
supabase functions deploy telegram-webhook
supabase functions deploy notify
supabase functions deploy send-reminders
supabase functions deploy telegram-account
```
Run these from the project folder. `supabase/config.toml` tells the tool to use
each `index.js` and turns the login-token check off for the first three:
Telegram, the webhooks and the cron job cannot send a Supabase login token, so
each checks its own secret header instead. `telegram-account` keeps the normal
check, because the website calls it as the logged-in person.

### 4. Tell Telegram where to send messages
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<ref>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message"]'
```
It should answer `{"ok":true,...}`. Check later with `getWebhookInfo`.

### 5. Database Webhooks → `notify`
Dashboard → **Database → Webhooks** (enable if asked) → **Create a new hook**,
seven times:

| Name | Table | Events |
|---|---|---|
| `notify_help_requests` | `help_requests` | Update |
| `notify_skill_swap_joined` | `skill_session_attendees` | Insert |
| `notify_hangout_joined` | `hangout_attendees` | Insert |
| `notify_skill_swap_cancelled` | `skill_sessions` | Update |
| `notify_hangout_cancelled` | `hangouts` | Update |
| `notify_skill_swap_left` | `skill_session_attendees` | Delete |
| `notify_hangout_left` | `hangout_attendees` | Delete |

For each: type **HTTP Request**, method **POST**,
URL `https://<ref>.supabase.co/functions/v1/notify`, and add the HTTP header
`x-notify-secret` = your `NOTIFY_SECRET`.

### 6. Hourly reminders
Dashboard → **Integrations → Cron** (enable if asked) → **Create job**:
name `send_telegram_reminders`, schedule `0 * * * *` (every hour), type
**HTTP Request** (or Supabase Edge Function), method **POST**,
URL `https://<ref>.supabase.co/functions/v1/send-reminders`, header
`x-notify-secret` = your `NOTIFY_SECRET`.

## Testing
1. Profile → **Get updates on Telegram** → **Open Telegram** → tap **Start**.
   The bot says "You are connected" and the Profile page shows "Telegram is connected".
2. **Send me a test message** → it arrives in Telegram.
3. Post a request; in a private window, accept it as another account → the
   first account gets "Good news! ... will help you with ...".
4. Nothing arrives? Dashboard → **Edge Functions → (function) → Logs**, and
   Database → Webhooks → the hook's recent calls.

## Privacy
Messages contain names and titles only, never blocks, birth dates or phone
numbers. The bot never sees a phone number. People stop messages with `/stop`
or **Disconnect Telegram** on the Profile page.
