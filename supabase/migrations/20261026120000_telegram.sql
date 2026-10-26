-- ============================================================================
-- Telegram notifications: linked accounts, one-time link codes, reminder marks
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this whole file and press Run. (schema.sql already includes this for
-- new, empty projects, in section 14.) Safe to run again: tables and columns
-- are only created if missing and the function is replaced. No data changes.
--
-- People can link their Telegram account to get short messages: a neighbour
-- accepted their request, a task is done, they earned points, someone joined
-- their skill swap or hangout, and a reminder the day before a skill swap or
-- hangout they are going to.
--
-- The website never talks to Telegram. The Edge Functions in
-- supabase/functions/ do, using the bot token kept in Supabase secrets (see
-- supabase/functions/README.md for setup).
--
-- Linking: the Profile page calls create_telegram_link_code() and opens
-- t.me/<bot>?start=<code>. When the person taps Start, the telegram-webhook
-- function looks up the code and saves their chat id in telegram_links. No
-- phone number is ever stored.

create table if not exists public.telegram_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chat_id bigint not null unique,              -- one Telegram account per Kampung Spirit account
  linked_at timestamptz not null default now()
);

alter table public.telegram_links enable row level security;

drop policy if exists "See your own Telegram link" on public.telegram_links;
create policy "See your own Telegram link"
  on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the Edge Functions (which use the service role) add or remove links
revoke insert, update, delete on public.telegram_links from anon, authenticated;
grant select on public.telegram_links to authenticated;

-- One-time codes for the Start link. Nobody can read these from the browser.
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;

-- A fresh code for the logged-in person. Any older code of theirs stops working.
create or replace function public.create_telegram_link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_code text := replace(gen_random_uuid()::text, '-', '');   -- 32 random letters and digits
begin
  if me is null then
    raise exception 'Please log in again.';
  end if;

  delete from public.telegram_link_codes where user_id = me or expires_at < now();
  insert into public.telegram_link_codes (code, user_id) values (new_code, me);
  return new_code;
end;
$$;

revoke execute on function public.create_telegram_link_code() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;

-- The send-reminders function messages everyone going about a day before, once
alter table public.skill_sessions add column if not exists reminder_sent_at timestamptz;
alter table public.hangouts add column if not exists reminder_sent_at timestamptz;

-- The Edge Functions use the service_role, which skips RLS but still needs
-- table permissions. "Automatically expose new tables" is off, so nothing
-- grants them by default; without this they cannot read the link codes,
-- profiles, skill swaps or hangouts. service_role is only ever used on the
-- server (never in the browser), so it may use every table.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
