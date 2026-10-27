-- ============================================================================
-- Fix: hosts could make points from nothing by completing hangouts and skill
-- swaps early
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this whole file and press Run. (schema.sql already includes this fix
-- for new, empty projects.) Safe to run: it only replaces functions, no data
-- changes.
--
-- Why: complete_hangout() paid everyone straight away, with no check that the
-- hangout had started, so a host and a friend could create, complete and repeat.
-- complete_skill_session() had its start-time check turned off and paid the host
-- even when nobody joined, so a host could earn 90 points for a 3-hour session
-- in seconds, over and over. Both now refuse until the start time has passed and
-- someone besides the host has joined. Every check runs before the status
-- changes or any points are added.

create or replace function public.complete_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.hangouts;
  pay int;
begin
  -- Lock the row and run every check before anything changes
  select * into h from public.hangouts
  where id = hangout_id and host_id = auth.uid() and status = 'open'
  for update;
  if not found then
    raise exception 'Only the host can complete this hangout, and only while it is open.';
  end if;

  -- skill_session_start() comes from schema.sql section 8.1
  if public.skill_session_start(h.hangout_date, h.hangout_time) > now() then
    raise exception 'You can mark a hangout as done once it has started.';
  end if;

  -- The host is added as an attendee automatically, so look for anyone else
  if not exists (select 1 from public.hangout_attendees a
                 where a.hangout_id = h.id and a.user_id <> h.host_id) then
    raise exception 'Nobody else joined this hangout, so there are no points to give.';
  end if;

  update public.hangouts set status = 'completed' where id = h.id;

  pay := public.calc_hangout_points(h.duration);

  insert into public.points_ledger (user_id, amount, reason)
  select a.user_id, pay, 'Hangout: ' || h.title
  from public.hangout_attendees a
  where a.hangout_id = h.id;
end;
$$;

create or replace function public.complete_skill_session(swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.skill_sessions;
  pts int;
begin
  -- Lock the row and run every check before anything changes
  select * into s from public.skill_sessions
  where id = swap_id and host_id = auth.uid() and status = 'open'
  for update;
  if not found then
    raise exception 'This session cannot be marked as completed.';
  end if;

  if public.skill_session_start(s.session_date, s.session_time) > now() then
    raise exception 'You can mark a session as completed once it has started.';
  end if;

  if not exists (select 1 from public.skill_session_attendees a where a.session_id = s.id) then
    raise exception 'Nobody joined this session, so there are no points to give.';
  end if;

  update public.skill_sessions set status = 'completed' where id = s.id;

  pts := public.skill_swap_points(s.duration);

  insert into public.points_ledger (user_id, amount, reason)
  values (s.host_id, pts, 'Hosted skill swap: ' || s.title);

  insert into public.points_ledger (user_id, amount, reason)
  select a.user_id, pts, 'Joined skill swap: ' || s.title
  from public.skill_session_attendees a
  where a.session_id = s.id;
end;
$$;
