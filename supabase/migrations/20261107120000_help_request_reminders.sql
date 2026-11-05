-- ============================================================================
-- Help requests: Telegram reminders, "nobody could help in time", and
-- "please confirm"
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 21
-- already includes this change for new, empty projects.) Then redeploy:
--   supabase functions deploy send-reminders
--
-- The hourly send-reminders function (supabase/functions/send-reminders)
-- reads these columns to send each message once:
--   reminder_sent_at        about a day before an accepted request, to the
--                           helper and the person who asked
--   expired_notice_sent_at  the time passed while nobody had accepted it, to
--                           the person who asked
--   confirm_nudge_sent_at   the helper said it was done a day ago and it is
--                           still not confirmed, to the person who asked
-- and marked_done_at is when the helper pressed "done", so it knows when a
-- day has gone by.
--
-- None of these can be written from the browser: help_requests only grants
-- update on the request's own details (schema.sql section 4).

alter table public.help_requests add column if not exists reminder_sent_at timestamptz;
alter table public.help_requests add column if not exists expired_notice_sent_at timestamptz;
alter table public.help_requests add column if not exists confirm_nudge_sent_at timestamptz;
alter table public.help_requests add column if not exists marked_done_at timestamptz;

-- Keeps those columns right as a request changes, without touching the
-- functions that change it (accept_help_request and the others): a trigger
-- on the row, like the rules in sections 18 to 20.
create or replace function public.help_requests_notice_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Moved to a new time: everyone should hear about the new one
  if new.needed_at is distinct from old.needed_at then
    new.reminder_sent_at := null;
    new.expired_notice_sent_at := null;
  end if;

  -- A different helper (someone withdrew and another accepted): remind them too
  if new.helper_id is distinct from old.helper_id then
    new.reminder_sent_at := null;
  end if;

  -- The helper pressed "done": start the one-day wait before "please confirm"
  if new.status = 'pending_confirmation' and old.status is distinct from 'pending_confirmation' then
    new.marked_done_at := now();
    new.confirm_nudge_sent_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.help_requests_notice_times() from public, anon, authenticated;

drop trigger if exists help_requests_notice_times on public.help_requests;
create trigger help_requests_notice_times
  before update of needed_at, helper_id, status on public.help_requests
  for each row execute function public.help_requests_notice_times();

-- Requests already waiting for a confirmation start their day now, so they
-- get one nudge tomorrow instead of never
update public.help_requests
set marked_done_at = now()
where status = 'pending_confirmation' and marked_done_at is null;
