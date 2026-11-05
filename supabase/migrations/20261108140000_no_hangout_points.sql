-- ============================================================================
-- Hangouts no longer earn points
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 7
-- already includes this change for new, empty projects.)
--
-- Why: a hangout is open to anyone, so people turn up without signing up and
-- the host cannot say who came. Paying everyone who signed up made hangouts
-- the easiest way to farm points (sign up, never go, still get paid). Points
-- now come from helping (help requests) and teaching (skill swaps, where the
-- host ticks who came). Hangouts are for getting to know your neighbours.
--
-- "Mark as done" still works: it closes the hangout and takes it off the
-- host's list. It no longer needs someone else to have joined, because
-- there is nothing to pay out. Points already earned from past hangouts stay.
--
-- calc_hangout_points() is left in place, unused, so nothing that still
-- mentions it breaks.

create or replace function public.complete_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.hangouts;
begin
  -- Lock the row and run every check before anything changes
  select * into h from public.hangouts
  where id = hangout_id and host_id = auth.uid() and status = 'open'
  for update;
  if not found then
    raise exception 'Only the host can complete this hangout, and only while it is open.';
  end if;

  -- skill_session_start() is defined further down (section 8.1). That is fine:
  -- plpgsql looks it up when this runs, not when the function is created.
  if public.skill_session_start(h.hangout_date, h.hangout_time) > now() then
    raise exception 'You can mark a hangout as done once it has started.';
  end if;

  -- Hangouts earn no points (anyone may turn up, so nobody can say who came),
  -- so marking one done only closes it
  update public.hangouts set status = 'completed' where id = h.id;
end;
$$;
