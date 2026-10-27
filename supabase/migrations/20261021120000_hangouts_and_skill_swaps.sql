-- ============================================================================
-- Hangouts, Skill Swaps and the community challenge total
-- ============================================================================
-- Run once on a project that already has the older schema.sql (with help
-- requests but no Hangouts or Skill Swaps): SQL Editor -> New query, paste this
-- whole file and press Run. Safe to run again: tables, indexes, triggers and
-- policies are only created if missing, functions are replaced, no data changes.
--
-- Why: hangouts, skill swaps and community_points_this_month() were only ever
-- added to schema.sql, never as a migration, so an older database had no way to
-- get them, and the 20261023 migrations failed there because these tables did
-- not exist. This is a copy of schema.sql sections 7, 8 and 9 (with the latest
-- rules) and community_points_this_month(), without the sample data.

-- ============================================================================
-- 7. Hotspot hangouts
-- ============================================================================
-- Hotspot ids come from src/lib/hotspots.js. They are plain text, not a table,
-- because hotspots almost never change.

-- Same rule as pointsForHangout() in lib/points.js: 20 points for an hour.
-- If you change one, change BOTH or the preview will not match what is paid.
create or replace function public.calc_hangout_points(duration int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(20 * (duration / 60.0))::int
$$;

create table if not exists public.hangouts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) >= 5),
  description text not null check (length(trim(description)) >= 10),
  hotspot_id text not null check (length(trim(hotspot_id)) > 0),
  hangout_date date not null,
  hangout_time time not null,
  duration int not null check (duration in (30, 60, 90, 120)),
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists hangouts_status_idx on public.hangouts (status);
create index if not exists hangouts_host_id_idx on public.hangouts (host_id);
create index if not exists hangouts_hotspot_id_idx on public.hangouts (hotspot_id);

create table if not exists public.hangout_attendees (
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hangout_id, user_id)
);

create index if not exists hangout_attendees_user_id_idx on public.hangout_attendees (user_id);

-- The host is always counted as attending, so nobody has to remember to join
-- their own hangout.
create or replace function public.hangouts_add_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hangout_attendees (hangout_id, user_id)
  values (new.id, new.host_id);
  return new;
end;
$$;

revoke execute on function public.hangouts_add_host() from public, anon, authenticated;

drop trigger if exists hangouts_add_host on public.hangouts;
create trigger hangouts_add_host
  after insert on public.hangouts
  for each row execute procedure public.hangouts_add_host();

alter table public.hangouts enable row level security;

drop policy if exists "See open hangouts and your own" on public.hangouts;
create policy "See open hangouts and your own"
  on public.hangouts for select to authenticated
  using (status = 'open' or host_id = (select auth.uid()));

drop policy if exists "Propose your own hangout" on public.hangouts;
create policy "Propose your own hangout"
  on public.hangouts for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'open');

-- Status changes go through the functions below, which check the rules.
revoke insert, update, delete on public.hangouts from anon, authenticated;
grant insert (title, description, hotspot_id, hangout_date, hangout_time, duration)
  on public.hangouts to authenticated;

alter table public.hangout_attendees enable row level security;

drop policy if exists "See who is going" on public.hangout_attendees;
create policy "See who is going"
  on public.hangout_attendees for select to authenticated
  using (true);

-- Joining and leaving go through join_hangout() and leave_hangout()
revoke insert, update, delete on public.hangout_attendees from anon, authenticated;


-- ----------------------------------------------------------------------------
-- Hangout actions, called with supabase.rpc('name', { hangout_id: ... })
-- When a rule fails, error.message is the plain sentence in raise exception.
-- ----------------------------------------------------------------------------

-- The final version from schema.sql section 9 (with the start-time and guardian checks)
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

create or replace function public.leave_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  h public.hangouts;
begin
  select * into h from public.hangouts where id = hangout_id;
  if not found then
    raise exception 'We could not find that hangout.';
  end if;

  if h.host_id = me then
    raise exception 'You are hosting this hangout. Cancel it instead.';
  end if;

  delete from public.hangout_attendees
  where hangout_attendees.hangout_id = h.id and user_id = me;
  if not found then
    raise exception 'You are not going to this hangout.';
  end if;
end;
$$;

create or replace function public.cancel_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hangouts
  set status = 'cancelled'
  where id = hangout_id and host_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'Only the host can cancel this hangout, and only while it is open.';
  end if;
end;
$$;

-- Host marks it done once it has started and someone else came. Everyone who
-- went, the host included, is paid once.
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

  -- skill_session_start() is defined further down (section 8.1). That is fine:
  -- plpgsql looks it up when this runs, not when the function is created.
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

revoke execute on function
  public.join_hangout(uuid),
  public.leave_hangout(uuid),
  public.cancel_hangout(uuid),
  public.complete_hangout(uuid)
from public, anon;

grant execute on function
  public.join_hangout(uuid),
  public.leave_hangout(uuid),
  public.cancel_hangout(uuid),
  public.complete_hangout(uuid),
  public.calc_hangout_points(int)
to authenticated;

-- Section 6 only grants select on the older tables, so add the new ones here
grant select on public.hangouts, public.hangout_attendees to authenticated;


-- Estate-wide community challenge total for the current month.
-- Uses security definer to bypass RLS and sum across all residents.
create or replace function public.community_points_this_month()
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::int
  from public.points_ledger
  where amount > 0
    and date_trunc('month', created_at) = date_trunc('month', now());
$$;

revoke execute on function public.community_points_this_month() from public, anon;
grant execute on function public.community_points_this_month() to authenticated, anon;


-- ----------------------------------------------------------------------------
-- 8.1 Small helper functions
-- ----------------------------------------------------------------------------

-- Same rule as pointsForSkillSwap() in lib/points.js: 30 points per 60 minutes
create or replace function public.skill_swap_points(duration int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(30 * (duration / 60.0))::int
$$;

-- The moment a session starts, in Singapore time
create or replace function public.skill_session_start(d date, t time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (d + t) at time zone 'Asia/Singapore'
$$;

-- True for an under 18 whose guardian has not been verified yet
create or replace function public.is_unverified_minor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.age_in_years(pp.birth_date) < 18 and pp.guardian_verified_at is null, false)
  from public.profile_private pp
  where pp.id = uid
$$;

revoke execute on function public.is_unverified_minor(uuid) from public, anon;
grant execute on function public.is_unverified_minor(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8.2 Tables
-- ----------------------------------------------------------------------------

create table if not exists public.skill_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) >= 5),
  description text not null check (length(trim(description)) >= 1),
  category text not null check (category in
    ('Tech', 'Cooking', 'Crafts', 'Health & fitness', 'Arts & music', 'Languages', 'Other')),
  venue text not null check (length(trim(venue)) >= 3),
  session_date date not null,
  session_time time not null,
  duration int not null check (duration in (30, 60, 90, 120, 150, 180)),
  capacity int not null check (capacity between 1 and 10),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists skill_sessions_status_session_date_idx on public.skill_sessions (status, session_date);
create index if not exists skill_sessions_host_id_idx on public.skill_sessions (host_id);

-- Who has a place. The primary key stops anyone joining the same session twice.
create table if not exists public.skill_session_attendees (
  session_id uuid not null references public.skill_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists skill_session_attendees_user_id_idx on public.skill_session_attendees (user_id);

-- Checks a new session before it is saved
create or replace function public.skill_sessions_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.skill_session_start(new.session_date, new.session_time) < now() then
    raise exception 'That day and time have already passed.';
  end if;

  if public.is_unverified_minor(new.host_id) then
    raise exception 'Your parent or guardian needs to confirm your account before you can host.';
  end if;

  return new;
end;
$$;

revoke execute on function public.skill_sessions_check() from public, anon, authenticated;

drop trigger if exists skill_sessions_check on public.skill_sessions;
create trigger skill_sessions_check
  before insert on public.skill_sessions
  for each row execute procedure public.skill_sessions_check();


-- ----------------------------------------------------------------------------
-- 8.3 Who can see and change what (Row Level Security)
-- ----------------------------------------------------------------------------

alter table public.skill_sessions enable row level security;
alter table public.skill_session_attendees enable row level security;

drop policy if exists "See open sessions and your own" on public.skill_sessions;
create policy "See open sessions and your own"
  on public.skill_sessions for select to authenticated
  using (status = 'open' or host_id = (select auth.uid()));

drop policy if exists "Host your own session" on public.skill_sessions;
create policy "Host your own session"
  on public.skill_sessions for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'open');

-- Everyone can see who has a place (so the spots left are right). Names still
-- come from profiles, which logged-in users can already read.
drop policy if exists "See who has a place" on public.skill_session_attendees;
create policy "See who has a place"
  on public.skill_session_attendees for select to authenticated
  using (true);

-- The browser may only add a session with these columns. Joining, leaving,
-- cancelling and completing go through the functions in 8.4.
revoke insert, update, delete on public.skill_sessions from anon, authenticated;
grant insert (title, description, category, venue, session_date, session_time, duration, capacity)
  on public.skill_sessions to authenticated;

revoke insert, update, delete on public.skill_session_attendees from anon, authenticated;

-- "Automatically expose new tables" is off, so reading must be granted here too.
-- RLS still decides which rows each person sees.
grant select on public.skill_sessions, public.skill_session_attendees to authenticated;


-- ----------------------------------------------------------------------------
-- 8.4 Skill swap actions, called with supabase.rpc('name', { swap_id: ... })
-- ----------------------------------------------------------------------------
-- When a rule fails, error.message is the plain sentence in raise exception.

-- Join a session
create or replace function public.join_skill_session(swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s public.skill_sessions;
  taken int;
begin
  -- Lock the row, so two people cannot both take the last spot
  select * into s from public.skill_sessions where id = swap_id for update;
  if not found or s.status <> 'open' then
    raise exception 'This session is no longer open.';
  end if;

  if s.host_id = me then
    raise exception 'You are hosting this session, so you already have a place.';
  end if;

  if public.skill_session_start(s.session_date, s.session_time) < now() then
    raise exception 'This session has already started.';
  end if;

  if public.is_unverified_minor(me) then
    raise exception 'Your parent or guardian needs to confirm your account before you can join.';
  end if;

  if exists (select 1 from public.skill_session_attendees a where a.session_id = s.id and a.user_id = me) then
    raise exception 'You already have a place in this session.';
  end if;

  select count(*) into taken from public.skill_session_attendees a where a.session_id = s.id;
  if taken >= s.capacity then
    raise exception 'Sorry, this session is full.';
  end if;

  insert into public.skill_session_attendees (session_id, user_id) values (s.id, me);
end;
$$;

-- Give up your place
create or replace function public.leave_skill_session(swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.skill_session_attendees a
  using public.skill_sessions s
  where a.session_id = swap_id
    and a.user_id = auth.uid()
    and s.id = a.session_id
    and s.status = 'open';
  if not found then
    raise exception 'You do not have a place in this session.';
  end if;
end;
$$;

-- The host cancels
create or replace function public.cancel_skill_session(swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.skill_sessions
  set status = 'cancelled'
  where id = swap_id and host_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'This session can no longer be cancelled.';
  end if;
end;
$$;

-- The host says it happened: the host and everyone with a place earn points
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

revoke execute on function
  public.join_skill_session(uuid),
  public.leave_skill_session(uuid),
  public.cancel_skill_session(uuid),
  public.complete_skill_session(uuid)
from public, anon;

grant execute on function
  public.join_skill_session(uuid),
  public.leave_skill_session(uuid),
  public.cancel_skill_session(uuid),
  public.complete_skill_session(uuid)
to authenticated;

grant execute on function public.skill_swap_points(int) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. Hangout rules (schema.sql section 9; join_hangout is in section 7 above)
-- ----------------------------------------------------------------------------

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

-- Make the new tables and functions visible to the API straight away
notify pgrst, 'reload schema';
