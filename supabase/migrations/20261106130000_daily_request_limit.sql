-- ============================================================================
-- Help requests: at most 3 posted per person per day (Singapore time)
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 20
-- already includes this change for new, empty projects.)
--
-- Why: so one person cannot flood the Help Board. Every request posted today
-- counts, whatever its status now, so cancelling one does not free a place.
-- Editing a request is an update, not an insert, so it never counts.
-- The pages (SeniorHelpBoardView.vue, SeniorCreateRequestView.vue) only show
-- the limit early; this trigger is what enforces it.

-- Must match MAX_REQUESTS_PER_DAY in src/stores/helpRequest.js
create or replace function public.help_requests_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  posted_today int;
begin
  -- One post at a time per person, so two posts sent at the same moment cannot
  -- both count 2 and slip through. The lock is let go when the transaction ends.
  perform pg_advisory_xact_lock(hashtext('help_requests_daily_limit'), hashtext(new.requester_id::text));

  select count(*) into posted_today
  from public.help_requests r
  where r.requester_id = new.requester_id
    and (r.created_at at time zone 'Asia/Singapore')::date = (now() at time zone 'Asia/Singapore')::date;

  if posted_today >= 3 then
    raise exception 'You can post up to 3 help requests a day. Please try again tomorrow.';
  end if;
  return new;
end;
$$;

revoke execute on function public.help_requests_daily_limit() from public, anon, authenticated;

drop trigger if exists help_requests_daily_limit on public.help_requests;
create trigger help_requests_daily_limit
  before insert on public.help_requests
  for each row execute function public.help_requests_daily_limit();
