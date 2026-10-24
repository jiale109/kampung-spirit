-- ============================================================================
-- Fix: hangouts had none of the database rules that skill swaps have
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this whole file and press Run. (schema.sql already includes this fix
-- for new, empty projects, in section 9.) Safe to run again: it replaces a
-- trigger and two functions, no data changes.
--
-- Why: the page checked these rules, but anyone could call the API directly
-- and create a hangout in the past, host or join one as an under-18 whose
-- guardian has not confirmed their account, or join one that had already
-- started. Skill swaps refuse all of these in the database (section 8);
-- hangouts now do too.

-- Checks a new hangout before it is saved (same rules as skill_sessions_check)
create or replace function public.hangouts_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.skill_session_start(new.hangout_date, new.hangout_time) < now() then
    raise exception 'That day and time have already passed.';
  end if;

  if public.is_unverified_minor(new.host_id) then
    raise exception 'Your parent or guardian needs to confirm your account before you can host.';
  end if;

  return new;
end;
$$;

revoke execute on function public.hangouts_check() from public, anon, authenticated;

drop trigger if exists hangouts_check on public.hangouts;
create trigger hangouts_check
  before insert on public.hangouts
  for each row execute procedure public.hangouts_check();

-- Join a hangout: the same as section 7, plus the start-time and guardian checks
create or replace function public.join_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  h public.hangouts;
begin
  select * into h from public.hangouts where id = hangout_id for update;
  if not found or h.status <> 'open' then
    raise exception 'Sorry, this hangout is no longer open.';
  end if;

  if exists (select 1 from public.hangout_attendees
             where hangout_attendees.hangout_id = h.id and user_id = me) then
    raise exception 'You are already going to this hangout.';
  end if;

  if public.skill_session_start(h.hangout_date, h.hangout_time) <= now() then
    raise exception 'This hangout has already started, so it is too late to join.';
  end if;

  if public.is_unverified_minor(me) then
    raise exception 'Your parent or guardian needs to confirm your account before you can join.';
  end if;

  insert into public.hangout_attendees (hangout_id, user_id) values (h.id, me);
end;
$$;
