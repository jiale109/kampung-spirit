-- ============================================================================
-- Help requests: no posting, moving or accepting a time that has passed
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 19
-- already includes this change for new, empty projects.)
--
-- Why: the form in RequestForm.vue already refuses a time in the past, but
-- the database did not, so a request sent around the form could be posted
-- for yesterday, and an old request could still be accepted. Hangouts and
-- skill swaps already have this rule (hangouts_check, skill_sessions_check).
--
-- Like the admin rules (section 18), this is a trigger on the row rather
-- than a new copy of accept_help_request(), so no newer rule in that
-- function can be undone by an old copy. Requests already in the past are
-- left alone; they only meet this rule if someone edits their time or
-- tries to accept them.

create or replace function public.help_requests_check_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Posting, or moving the day and time: it must still be ahead. Editing only
  -- the words of a request does not change needed_at, so that is not stopped.
  if (tg_op = 'INSERT' or new.needed_at is distinct from old.needed_at)
     and new.needed_at < now() then
    raise exception 'That day and time have already passed. Please choose a later time.';
  end if;

  -- Accepting (a helper is set where there was none): too late once the time has gone
  if tg_op = 'UPDATE' and new.helper_id is not null and old.helper_id is null
     and new.needed_at < now() then
    raise exception 'Sorry, the time for this request has already passed.';
  end if;

  return new;
end;
$$;

revoke execute on function public.help_requests_check_time() from public, anon, authenticated;

drop trigger if exists help_requests_check_time on public.help_requests;
create trigger help_requests_check_time
  before insert or update of needed_at, helper_id on public.help_requests
  for each row execute function public.help_requests_check_time();
