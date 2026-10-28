-- ============================================================================
-- Kampung Spirit: Supabase database                         Owner: Reuben Tham
-- ============================================================================
-- How to use: in the Supabase dashboard open SQL Editor -> New query, paste
-- this whole file and press Run. Run it on an EMPTY project (for example a new
-- test project). Project settings this file expects:
--   - Data API enabled, "Automatically expose new tables" off, automatic RLS on
--   - Authentication -> Email: "Confirm email" off while developing
--
-- Overview
--   profiles          name, block, interests, large_text      (all logged-in users can read)
--   profile_private   birth date, guardian details            (only the user can read their own row)
--   help_requests     requests; status changes go through the functions in section 5
--   points_ledger     every points change; only the database functions can add rows
--
-- Rules the database enforces
--   - Sign up: 12 or older; ages 12-17 must give a guardian's name, email and consent.
--   - Age groups: youth 12-21, adult 22-64, senior 65+ (worked out from the birth date).
--   - Anyone can ask for help and anyone can help, but not on their own request.
--   - A helper can have at most 2 active tasks.
--   - Under 18s cannot accept tasks until an admin sets guardian_verified_at.
--   - Seniors must confirm a warning before accepting a physical task.
--   - Points are calculated here, and only awarded when the requester confirms.
--
-- Adding a table for your feature? Enable RLS, add policies, AND add grant lines
-- (see section 6). Without grants the app gets "permission denied for table ...".


-- ============================================================================
-- 1. Age groups
-- ============================================================================
-- Whole years old today, using Singapore's date (the database clock is UTC).
-- Always compare this number, never age() against an interval: Postgres counts
-- a month as 30 days when comparing intervals, so "64 years 11 mons 30 days"
-- (the day before some 65th birthdays) counts as 65 years.
create function public.age_in_years(birth_date date)
returns int
language sql
stable
set search_path = ''
as $$
  select extract(year from age((now() at time zone 'Asia/Singapore')::date, birth_date))::int
$$;

create function public.age_group_for(birth_date date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when birth_date is null then null
    when public.age_in_years(birth_date) < 12 then null   -- too young
    when public.age_in_years(birth_date) < 22 then 'youth'
    when public.age_in_years(birth_date) < 65 then 'adult'
    else 'senior'
  end
$$;


-- ============================================================================
-- 2. Profiles
-- ============================================================================

-- Public profile: what other logged-in users can see
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  block text not null,
  interests text[] not null default '{}',
  large_text boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Logged-in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may only edit these columns
revoke update on public.profiles from authenticated;
grant update (name, block, interests, large_text) on public.profiles to authenticated;

-- Private details: only the user can read their own row, nobody can edit it from the app
create table public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date not null,
  guardian_name text,
  guardian_email text,
  guardian_consent_at timestamptz,   -- when the sign-up form was ticked
  guardian_verified_at timestamptz   -- set by an admin (later: by the guardian's email link)
);

alter table public.profile_private enable row level security;

create policy "Users can read their own private details"
  on public.profile_private for select to authenticated
  using ((select auth.uid()) = id);

revoke all on public.profile_private from anon;

-- Calculated fields on profiles, used like columns:
--   supabase.from('profiles').select('id, name, block, age_group, guardian_status')

-- Everyone can see a person's age group, never their birth date
create function public.age_group(p public.profiles)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.age_group_for(pp.birth_date)
  from public.profile_private pp
  where pp.id = p.id
$$;

-- 'not_needed', 'pending' or 'verified'. Only visible for your own profile (null for others).
create function public.guardian_status(p public.profiles)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.age_in_years(pp.birth_date) >= 18 then 'not_needed'
    when pp.guardian_verified_at is not null then 'verified'
    else 'pending'
  end
  from public.profile_private pp
  where pp.id = p.id
    and p.id = (select auth.uid())
$$;

revoke execute on function public.age_group(public.profiles) from public, anon;
revoke execute on function public.guardian_status(public.profiles) from public, anon;
grant execute on function public.age_group(public.profiles) to authenticated;
grant execute on function public.guardian_status(public.profiles) to authenticated;


-- ============================================================================
-- 3. Sign up: check the age rules and create both profile rows
-- ============================================================================
-- The sign-up form (stores/auth.js register()) sends: name, block,
-- birth_date (YYYY-MM-DD), large_text, and for under 18s: guardian_name,
-- guardian_email, guardian_consent (true).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  dob date := (meta ->> 'birth_date')::date;
  is_minor boolean;
begin
  if public.age_group_for(dob) is null then
    raise exception 'You must be at least 12 years old to sign up.';
  end if;

  is_minor := public.age_in_years(dob) < 18;

  if is_minor and (
       coalesce(trim(meta ->> 'guardian_name'), '') = ''
    or coalesce(trim(meta ->> 'guardian_email'), '') = ''
    or coalesce((meta ->> 'guardian_consent')::boolean, false) = false
  ) then
    raise exception 'Under 18s need a parent or guardian''s name, email and consent.';
  end if;

  insert into public.profiles (id, name, block, large_text)
  values (
    new.id,
    meta ->> 'name',
    meta ->> 'block',
    coalesce((meta ->> 'large_text')::boolean, false)
  );

  insert into public.profile_private (id, birth_date, guardian_name, guardian_email, guardian_consent_at)
  values (
    new.id,
    dob,
    case when is_minor then meta ->> 'guardian_name' end,
    case when is_minor then meta ->> 'guardian_email' end,
    case when is_minor then now() end
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- 4. Help requests and points
-- ============================================================================

-- Same points rule as lib/points.js: 10 x difficulty x (minutes / 30)
create function public.calc_points(difficulty text, duration int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(10 * (case difficulty when 'Easy' then 1 when 'Medium' then 2 when 'Hard' then 3 end)
               * (duration / 30.0))::int
$$;

-- Categories that always count as physical
create function public.is_physical_category(category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select category in ('Lifting', 'Companion Walk')
$$;

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  helper_id uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) >= 5),
  description text not null check (length(trim(description)) >= 10),
  category text not null check (category in ('Tech', 'Grocery', 'Lifting', 'Translation', 'Companion Walk', 'Other')),
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  duration int not null check (duration in (15, 30, 45, 60, 90, 120)),
  is_physical boolean not null default false,
  needed_at timestamptz not null,        -- when the requester needs the help
  location text not null check (length(trim(location)) between 1 and 100),  -- where the helper meets the requester
  latitude numeric,                      -- the pin for location; null on older requests
  longitude numeric,
  points int not null default 0,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'pending_confirmation', 'completed', 'cancelled')),
  physical_warning_ack_at timestamptz,   -- when the helper confirmed the physical warning
  created_at timestamptz not null default now(),
  -- Both empty, or both inside Singapore (the same box as the hangouts check)
  constraint help_requests_inside_singapore check (
    (latitude is null and longitude is null)
    or (latitude between 1.1 and 1.6 and longitude between 103.5 and 104.2)
  )
);

create index on public.help_requests (status);
create index on public.help_requests (requester_id);
create index on public.help_requests (helper_id);

-- Points and the physical flag are always set here, so the browser cannot fake them
create function public.help_requests_fill_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.points := public.calc_points(new.difficulty, new.duration);
  new.is_physical := new.is_physical or public.is_physical_category(new.category);
  return new;
end;
$$;

revoke execute on function public.help_requests_fill_in() from public, anon, authenticated;

create trigger help_requests_fill_in
  before insert or update of difficulty, duration, category, is_physical on public.help_requests
  for each row execute procedure public.help_requests_fill_in();

alter table public.help_requests enable row level security;

create policy "See open requests and your own"
  on public.help_requests for select to authenticated
  using (
    status = 'open'
    or requester_id = (select auth.uid())
    or helper_id = (select auth.uid())
  );

create policy "Post your own request"
  on public.help_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'open' and helper_id is null);

create policy "Edit your own request while it is open"
  on public.help_requests for update to authenticated
  using (requester_id = (select auth.uid()) and status = 'open')
  with check (requester_id = (select auth.uid()) and status = 'open');

-- The browser may only write these columns. Status changes go through the
-- functions in section 5, which check the rules.
revoke insert, update, delete on public.help_requests from anon, authenticated;
grant insert (title, description, category, difficulty, duration, is_physical, needed_at, location, latitude, longitude) on public.help_requests to authenticated;
grant update (title, description, category, difficulty, duration, is_physical, needed_at, location, latitude, longitude) on public.help_requests to authenticated;

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),       -- positive = earned, negative = spent
  reason text not null,
  help_request_id uuid references public.help_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.points_ledger (user_id);

alter table public.points_ledger enable row level security;

create policy "See your own points"
  on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()));

-- Nobody adds points from the browser; only the functions below can
revoke insert, update, delete on public.points_ledger from anon, authenticated;


-- ============================================================================
-- 5. Help request actions, called with supabase.rpc('name', { ... })
-- ============================================================================
-- When a rule fails, error.message is the plain sentence in raise exception.

-- Accept a request. physical_ok = true once the helper has confirmed the warning.
create function public.accept_help_request(request_id uuid, physical_ok boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.help_requests;
  mine public.profile_private;
  active_count int;
begin
  select * into req from public.help_requests where id = request_id for update;
  if not found or req.status <> 'open' then
    raise exception 'Sorry, this request is no longer open.';
  end if;

  if req.requester_id = me then
    raise exception 'You cannot accept your own request.';
  end if;

  select * into mine from public.profile_private where id = me;
  if public.age_in_years(mine.birth_date) < 18 and mine.guardian_verified_at is null then
    raise exception 'Your parent or guardian needs to confirm your account before you can help.';
  end if;

  select count(*) into active_count from public.help_requests
  where helper_id = me and status in ('accepted', 'pending_confirmation');
  if active_count >= 2 then   -- Must match MAX_ACTIVE_TASKS in src/lib/points.js
    raise exception 'You can only have 2 active tasks. Finish one first.';
  end if;

  if req.is_physical and public.age_group_for(mine.birth_date) = 'senior' and not physical_ok then
    raise exception 'This task needs physical effort. Please confirm you are comfortable doing it.';
  end if;

  update public.help_requests
  set status = 'accepted',
      helper_id = me,
      physical_warning_ack_at = case when req.is_physical and physical_ok then now() end
  where id = request_id;
end;
$$;

-- Helper backs out; the request goes back on the board
create function public.withdraw_from_task(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.help_requests
  set status = 'open', helper_id = null, physical_warning_ack_at = null
  where id = request_id and helper_id = auth.uid() and status = 'accepted';
  if not found then
    raise exception 'You can only withdraw from a task you have accepted.';
  end if;
end;
$$;

-- Helper says it is done; now the requester must confirm
create function public.mark_task_done(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.help_requests
  set status = 'pending_confirmation'
  where id = request_id and helper_id = auth.uid() and status = 'accepted';
  if not found then
    raise exception 'This task cannot be marked as done.';
  end if;
end;
$$;

-- Requester cancels (while open or accepted)
create function public.cancel_help_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.help_requests
  set status = 'cancelled'
  where id = request_id and requester_id = auth.uid() and status in ('open', 'accepted');
  if not found then
    raise exception 'This request can no longer be cancelled.';
  end if;
end;
$$;

-- Requester confirms the help happened; the helper gets the points
create function public.confirm_help_done(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.help_requests;
begin
  update public.help_requests
  set status = 'completed'
  where id = request_id and requester_id = auth.uid() and status = 'pending_confirmation'
  returning * into req;
  if not found then
    raise exception 'This request is not waiting for your confirmation.';
  end if;

  if req.helper_id is not null then
    insert into public.points_ledger (user_id, amount, reason, help_request_id)
    values (req.helper_id, req.points, 'Completed help request: ' || req.title, req.id);
  end if;
end;
$$;

-- Only logged-in users can call these
revoke execute on function
  public.accept_help_request(uuid, boolean),
  public.withdraw_from_task(uuid),
  public.mark_task_done(uuid),
  public.cancel_help_request(uuid),
  public.confirm_help_done(uuid)
from public, anon;

grant execute on function
  public.accept_help_request(uuid, boolean),
  public.withdraw_from_task(uuid),
  public.mark_task_done(uuid),
  public.cancel_help_request(uuid),
  public.confirm_help_done(uuid)
to authenticated;


-- ============================================================================
-- 6. Read access for logged-in users
-- ============================================================================
-- Needed because "Automatically expose new tables" is off. RLS still decides
-- which rows each person sees.
grant select on
  public.profiles,
  public.profile_private,
  public.help_requests,
  public.points_ledger
to authenticated;

grant execute on function
  public.calc_points(text, int),
  public.is_physical_category(text),
  public.age_group_for(date),
  public.age_in_years(date)
to authenticated;


-- ============================================================================
-- 7. Hotspot hangouts
-- ============================================================================
-- Hotspot ids come from src/lib/hotspots.js. They are plain text, not a table,
-- because hotspots almost never change.

-- Same rule as pointsForHangout() in lib/points.js: 20 points for an hour.
-- If you change one, change BOTH or the preview will not match what is paid.
create function public.calc_hangout_points(duration int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(20 * (duration / 60.0))::int
$$;

create table public.hangouts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) >= 5),
  description text not null check (length(trim(description)) >= 10),
  hotspot_id text not null check (length(trim(hotspot_id)) > 0),
  hangout_date date not null,
  hangout_time time not null,
  duration int not null check (duration in (30, 60, 90, 120, 150, 180)),
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index on public.hangouts (status);
create index on public.hangouts (host_id);
create index on public.hangouts (hotspot_id);

create table public.hangout_attendees (
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hangout_id, user_id)
);

create index on public.hangout_attendees (user_id);

-- The host is always counted as attending, so nobody has to remember to join
-- their own hangout.
create function public.hangouts_add_host()
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

create trigger hangouts_add_host
  after insert on public.hangouts
  for each row execute procedure public.hangouts_add_host();

alter table public.hangouts enable row level security;

create policy "See open hangouts and your own"
  on public.hangouts for select to authenticated
  using (status = 'open' or host_id = (select auth.uid()));

create policy "Propose your own hangout"
  on public.hangouts for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'open');

-- Status changes go through the functions below, which check the rules.
revoke insert, update, delete on public.hangouts from anon, authenticated;
grant insert (title, description, hotspot_id, hangout_date, hangout_time, duration)
  on public.hangouts to authenticated;

alter table public.hangout_attendees enable row level security;

create policy "See who is going"
  on public.hangout_attendees for select to authenticated
  using (true);

-- Joining and leaving go through join_hangout() and leave_hangout()
revoke insert, update, delete on public.hangout_attendees from anon, authenticated;


-- ----------------------------------------------------------------------------
-- Hangout actions, called with supabase.rpc('name', { hangout_id: ... })
-- When a rule fails, error.message is the plain sentence in raise exception.
-- ----------------------------------------------------------------------------

-- Section 9 replaces this with the start-time and guardian checks added.
create function public.join_hangout(hangout_id uuid)
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

  insert into public.hangout_attendees (hangout_id, user_id) values (h.id, me);
end;
$$;

create function public.leave_hangout(hangout_id uuid)
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

create function public.cancel_hangout(hangout_id uuid)
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
create function public.complete_hangout(hangout_id uuid)
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

-- On an empty project this inserts nothing; run pnpm seed:demo instead.
-- Sample hangouts so the page is not empty. Optional: delete this block once
-- residents have made their own. The host is whoever signed up first, so no
-- user ids are hard-coded.
insert into public.hangouts (host_id, title, description, hotspot_id, hangout_date, hangout_time, duration)
select p.id, v.title, v.description, v.hotspot_id, current_date + v.days, v.at, v.duration
from (select id from public.profiles order by created_at limit 1) p,
(values
  ('Morning walk at the park', 'A gentle walk and a chat. We stop whenever anyone needs a rest.', 'eunos-park', 1, time '07:30', 60),
  ('Kopi and newspapers', 'Read the papers together over kopi. Come and go as you like.', 'eunos-crescent-market', 2, time '09:00', 60),
  ('Herb garden morning', 'Watering and weeding together. Gloves provided.', 'eunos-community-garden', 3, time '08:00', 90)
) as v(title, description, hotspot_id, days, at, duration);



-- Section 10 replaces this (Singapore months, bonus rows not counted, no anon access).
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

-------------------------------------------------------------------------------
-- 8.1 Small helper functions
-- ----------------------------------------------------------------------------
 
-- Same rule as pointsForSkillSwap() in lib/points.js: 30 points per 60 minutes
create function public.skill_swap_points(duration int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(30 * (duration / 60.0))::int
$$;
 
-- The moment a session starts, in Singapore time
create function public.skill_session_start(d date, t time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (d + t) at time zone 'Asia/Singapore'
$$;
 
-- True for an under 18 whose guardian has not been verified yet
create function public.is_unverified_minor(uid uuid)
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
 
create table public.skill_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) >= 5),
  description text not null check (length(trim(description)) >= 1),
  -- Any kind of session, not a fixed list: hosts may type their own, the way
  -- a resident may add an interest. src/lib/skillSwapFormat.js still offers
  -- seven suggestions and folds a typed-in one into them where it can.
  category text not null check (length(trim(category)) between 1 and 40),
  venue text not null check (length(trim(venue)) >= 3),  -- the place people read
  latitude numeric,                      -- the pin for venue; null on older sessions
  longitude numeric,
  session_date date not null,
  session_time time not null,
  duration int not null check (duration in (30, 60, 90, 120, 150, 180)),
  capacity int not null check (capacity between 1 and 10),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
 
-- Both empty, or both inside Singapore (the same box as help_requests)
alter table public.skill_sessions add constraint skill_sessions_inside_singapore
  check (
    (latitude is null and longitude is null)
    or (
      -- "is not null" is not spare: a CHECK passes when it evaluates to NULL,
      -- so without it a row with a latitude and no longitude slipped through
      latitude is not null and longitude is not null
      and latitude between 1.1 and 1.6 and longitude between 103.5 and 104.2
    )
  );

create index on public.skill_sessions (status, session_date);
create index on public.skill_sessions (host_id);
 
-- Who has a place. The primary key stops anyone joining the same session twice.
create table public.skill_session_attendees (
  session_id uuid not null references public.skill_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
 
create index on public.skill_session_attendees (user_id);
 
-- Checks a new session before it is saved
create function public.skill_sessions_check()
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
 
create trigger skill_sessions_check
  before insert on public.skill_sessions
  for each row execute procedure public.skill_sessions_check();
 
 
-- ----------------------------------------------------------------------------
-- 8.3 Who can see and change what (Row Level Security)
-- ----------------------------------------------------------------------------
 
alter table public.skill_sessions enable row level security;
alter table public.skill_session_attendees enable row level security;
 
create policy "See open sessions and your own"
  on public.skill_sessions for select to authenticated
  using (status = 'open' or host_id = (select auth.uid()));
 
create policy "Host your own session"
  on public.skill_sessions for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'open');
 
-- Everyone can see who has a place (so the spots left are right). Names still
-- come from profiles, which logged-in users can already read.
create policy "See who has a place"
  on public.skill_session_attendees for select to authenticated
  using (true);
 
-- The browser may only add a session with these columns. Joining, leaving,
-- cancelling and completing go through the functions in 8.4.
revoke insert, update, delete on public.skill_sessions from anon, authenticated;
grant insert (title, description, category, venue, latitude, longitude,
              session_date, session_time, duration, capacity)
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
create function public.join_skill_session(swap_id uuid)
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
create function public.leave_skill_session(swap_id uuid)
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
create function public.cancel_skill_session(swap_id uuid)
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
create function public.complete_skill_session(swap_id uuid)
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
 
 
-- On an empty project this inserts nothing; run pnpm seed:demo instead.
-- Sample sessions so the page is not empty. Optional: delete this block once
-- residents have made their own. The host is the first adult who signed up, so no
-- user ids are hard-coded. (If there is no adult account yet, nothing is inserted.)
insert into public.skill_sessions
  (host_id, title, description, category, venue, session_date, session_time, duration, capacity)
select p.id, v.title, v.description, v.category, v.venue, current_date + v.days, v.at, v.duration, v.capacity
from (select pr.id from public.profiles pr
      join public.profile_private pp on pp.id = pr.id
      where public.age_in_years(pp.birth_date) >= 18
      order by pr.created_at limit 1) p,
(values
  ('Crochet for beginners', 'Learn the basic stitches and make your first coaster. Wool and hooks are provided.',
   'Crafts', 'Void deck, Blk 412 Eunos Cres', 4, time '10:00', 90, 8),
  ('Staying safe with digital banking', 'Learn how to spot scam messages and use your banking app with confidence.',
   'Tech', 'Eunos CC, Level 2', 3, time '15:00', 60, 6),
  ('Traditional kueh making', 'Make kueh dadar from a family recipe, then taste it together.',
   'Cooking', 'Eunos CC kitchen', 6, time '11:00', 120, 6)
) as v(title, description, category, venue, days, at, duration, capacity);
 
-- ============================================================================
-- 9. Hangout rules
-- ============================================================================
-- The same rules skill swaps have: no hangouts in the past, no late joins, and
-- unverified under-18s cannot host or join. This is a separate section, not in
-- section 7, because it uses skill_session_start() and is_unverified_minor()
-- from section 8.1, and the sample hangouts in section 7 would fire the
-- trigger before those exist.

-- Checks a new hangout before it is saved (same rules as skill_sessions_check)
create function public.hangouts_check()
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

-- ============================================================================
-- 10. Rewards
-- ============================================================================
-- Spending points on vouchers, the voucher wallet and the monthly community
-- bonus. Nothing about points is saved in the browser: redeem_voucher() takes
-- the points and creates the wallet row in one step, and a trigger on
-- points_ledger pays the community bonus once per Singapore month.

-- ----------------------------------------------------------------------------
-- Vouchers (the shop). Costs MUST match src/lib/vouchers.js, or the page shows
-- one price and the database charges another.
-- ----------------------------------------------------------------------------
create table if not exists public.vouchers (
  id text primary key,
  title text not null,
  merchant text not null,
  cost int not null check (cost > 0)
);

insert into public.vouchers (id, title, merchant, cost) values
  ('v1', '$2 off any purchase', '7-Eleven', 50),
  ('v2', '$5 Grocery Voucher', 'FairPrice', 150),
  ('v3', 'Free Kopi / Teh with Toast', 'Kimly Kopitiam', 30),
  ('v4', '$10 Grocery Voucher', 'Cold Storage', 250),
  ('v5', '$5 wellness & medicine discount', 'Unity Pharmacy', 140),
  ('v7', '$3 Guardian Voucher', 'Guardian', 80)
on conflict (id) do update set title = excluded.title, merchant = excluded.merchant, cost = excluded.cost;

alter table public.vouchers enable row level security;

drop policy if exists "Logged-in users can see vouchers" on public.vouchers;
create policy "Logged-in users can see vouchers"
  on public.vouchers for select to authenticated
  using (true);

revoke insert, update, delete on public.vouchers from anon, authenticated;
grant select on public.vouchers to authenticated;

-- Bonus rows are marked, so they are not counted towards the challenge and
-- never pay the bonus again. Existing functions leave it at the default.
alter table public.points_ledger add column if not exists is_bonus boolean not null default false;

-- ----------------------------------------------------------------------------
-- Wallet: the vouchers each person has redeemed
-- ----------------------------------------------------------------------------
create table if not exists public.wallet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  voucher_id text not null references public.vouchers(id),
  code text not null unique,
  redeemed_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists wallet_items_user_id_idx on public.wallet_items (user_id);

alter table public.wallet_items enable row level security;

drop policy if exists "See your own vouchers" on public.wallet_items;
create policy "See your own vouchers"
  on public.wallet_items for select to authenticated
  using (user_id = (select auth.uid()));

-- Redeeming and marking as used go through the functions below
revoke insert, update, delete on public.wallet_items from anon, authenticated;
grant select on public.wallet_items to authenticated;

-- Spend points on a voucher. The points and the wallet row are saved together
-- (one function, one transaction), so points are never taken without a voucher.
create or replace function public.redeem_voucher(voucher_id text)
returns public.wallet_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v public.vouchers;
  balance int;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  item public.wallet_items;
  tries int := 0;
begin
  -- One redeem at a time per person, so two quick presses cannot both pass the balance check
  perform 1 from public.profiles where id = me for update;

  select * into v from public.vouchers where id = redeem_voucher.voucher_id;
  if not found then
    raise exception 'Sorry, this voucher could not be found.';
  end if;

  select coalesce(sum(amount), 0)::int into balance from public.points_ledger where user_id = me;
  if balance < v.cost then
    raise exception 'You need % points, but you only have % points.', v.cost, balance;
  end if;

  insert into public.points_ledger (user_id, amount, reason)
  values (me, -v.cost, 'Redeemed voucher: ' || v.title || ' (' || v.merchant || ')');

  -- 'KS-' and 5 random characters; try again on the rare clash with an existing code
  loop
    tries := tries + 1;
    new_code := 'KS-';
    for i in 1..5 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.wallet_items (user_id, voucher_id, code)
      values (me, v.id, new_code)
      returning * into item;
      exit;
    exception when unique_violation then
      if tries >= 10 then
        raise exception 'Sorry, something went wrong. Please try again.';
      end if;
    end;
  end loop;

  return item;
end;
$$;

-- Mark one of your own vouchers as used
create or replace function public.mark_voucher_used(item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wallet_items
  set used_at = now()
  where id = item_id and user_id = auth.uid() and used_at is null;
  if not found then
    raise exception 'This voucher is already used or is not yours.';
  end if;
end;
$$;

revoke execute on function
  public.redeem_voucher(text),
  public.mark_voucher_used(uuid)
from public, anon;

grant execute on function
  public.redeem_voucher(text),
  public.mark_voucher_used(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Community challenge (months are Singapore months)
-- ----------------------------------------------------------------------------

-- One row per month the bonus has been paid, so it is paid exactly once.
-- No browser access at all: RLS on and no policies.
create table if not exists public.community_bonus_paid (
  month date primary key,
  paid_at timestamptz not null default now()
);

alter table public.community_bonus_paid enable row level security;
revoke all on public.community_bonus_paid from anon, authenticated;

-- Points earned by everyone this month, not counting bonuses
create or replace function public.community_points_this_month()
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::int
  from public.points_ledger
  where amount > 0
    and not is_bonus
    and date_trunc('month', created_at at time zone 'Asia/Singapore')
      = date_trunc('month', now() at time zone 'Asia/Singapore');
$$;

revoke execute on function public.community_points_this_month() from public, anon;
grant execute on function public.community_points_this_month() to authenticated;

-- When earned points push the month past the target, pay every contributor
-- this month a bonus, once. 10000 and 50 MUST match COMMUNITY_TARGET and
-- COMMUNITY_BONUS in src/lib/points.js. Bonus rows have is_bonus = true, so
-- they never fire the bonus again.
create or replace function public.pay_community_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_month date := date_trunc('month', now() at time zone 'Asia/Singapore')::date;
  paid_month date;
begin
  if new.amount <= 0 or new.is_bonus then
    return null;
  end if;

  if public.community_points_this_month() < 10000 then
    return null;
  end if;

  -- Only the first insert that gets here adds the row; everyone else gets nothing back
  insert into public.community_bonus_paid (month) values (this_month)
  on conflict do nothing
  returning month into paid_month;
  if paid_month is null then
    return null;
  end if;

  insert into public.points_ledger (user_id, amount, reason, is_bonus)
  select distinct pl.user_id, 50, 'Community Challenge bonus (' || to_char(this_month, 'Mon YYYY') || ')', true
  from public.points_ledger pl
  where pl.amount > 0
    and not pl.is_bonus
    and date_trunc('month', pl.created_at at time zone 'Asia/Singapore')::date = this_month;

  return null;
end;
$$;

revoke execute on function public.pay_community_bonus() from public, anon, authenticated;

drop trigger if exists pay_community_bonus on public.points_ledger;
create trigger pay_community_bonus
  after insert on public.points_ledger
  for each row execute procedure public.pay_community_bonus();

-- Make the new tables and functions visible to the API straight away
notify pgrst, 'reload schema';

-- ============================================================================
-- 11. Hangouts can be anywhere, not only a known hotspot
-- ============================================================================
-- Hosts may now search OneMap for any place in Singapore. Every hangout keeps
-- its OWN name and coordinates, even when a known hotspot was chosen, so the
-- card and the map never have to look anything up in src/lib/hotspots.js.
--
-- hotspot_id stays, but only as a tag used by the "filter by place" dropdown.
-- It is null for a place that was searched for.
--
-- outdoor is set by the host on the form. It cannot be worked out for an
-- arbitrary address, and it decides whether the rain warning is shown.

alter table public.hangouts add column place_name text;
alter table public.hangouts add column latitude numeric;
alter table public.hangouts add column longitude numeric;
alter table public.hangouts add column outdoor boolean not null default false;

-- Fill in the hangouts that already exist, using the same values as
-- src/lib/hotspots.js, so nothing is left without a place.
update public.hangouts set
  place_name = 'Eunos Community Club', latitude = 1.332644, longitude = 103.915255, outdoor = false
  where hotspot_id = 'eunos-cc' and place_name is null;
update public.hangouts set
  place_name = 'Eunos Crescent Market and Food Centre', latitude = 1.32, longitude = 103.9035, outdoor = false
  where hotspot_id = 'eunos-crescent-market' and place_name is null;
update public.hangouts set
  place_name = 'Eunos MRT Station', latitude = 1.3197, longitude = 103.903, outdoor = false
  where hotspot_id = 'eunos-mrt' and place_name is null;
update public.hangouts set
  place_name = 'Eunos Community Garden', latitude = 1.3215, longitude = 103.9065, outdoor = true
  where hotspot_id = 'eunos-community-garden' and place_name is null;
update public.hangouts set
  place_name = 'Eunos Link Park', latitude = 1.3245, longitude = 103.9085, outdoor = true
  where hotspot_id = 'eunos-park' and place_name is null;

-- Anything still empty (a hotspot id we no longer know) keeps the id as its
-- name, so no row is left half filled in.
update public.hangouts set place_name = hotspot_id where place_name is null;
update public.hangouts set latitude = 1.332644, longitude = 103.915255
  where latitude is null or longitude is null;

-- Now every row has a place, so these can be required from here on
alter table public.hangouts alter column place_name set not null;
alter table public.hangouts alter column latitude set not null;
alter table public.hangouts alter column longitude set not null;
alter table public.hangouts alter column hotspot_id drop not null;

-- A name people can read, and coordinates that are actually in Singapore
alter table public.hangouts add constraint hangouts_place_name_not_blank
  check (length(trim(place_name)) >= 3);
alter table public.hangouts add constraint hangouts_inside_singapore
  check (latitude between 1.1 and 1.6 and longitude between 103.5 and 104.2);

-- The browser may write the new columns too (status still goes through the
-- functions in section 7)
grant insert (title, description, hotspot_id, place_name, latitude, longitude, outdoor,
              hangout_date, hangout_time, duration)
  on public.hangouts to authenticated;


-- ============================================================================
-- 12. Hangouts can last up to three hours
-- ============================================================================
-- The form offers 30 minutes to 3 hours in half hour steps, so the check on
-- duration has to allow 150 and 180 as well. Half hours only: the points are
-- worked out per hour in calc_hangout_points(), and whole half hours keep
-- that sum tidy (3 hours earns 60 points).
--
-- The list here must match HANGOUT_DURATIONS in src/stores/hangout.js.
-- Change one, change the other.
--
-- Postgres named the original check for us when the column was made in
-- section 7, so it is dropped by that name and put back wider.

alter table public.hangouts drop constraint hangouts_duration_check;
alter table public.hangouts add constraint hangouts_duration_check
  check (duration in (30, 60, 90, 120, 150, 180));


-- ============================================================================
-- 13. Avatars: gender and skin tone
-- ============================================================================
-- The sprite beside someone's details used to depend on age_group alone. A
-- resident may now also choose how it looks, from the 24 pictures in
-- public/images, named {age group}-{gender}-{skin tone}.svg.
--
-- Both columns are allowed to be null, which is how everyone who signed up
-- before today starts out. A profile with no choice yet simply shows no
-- picture and is invited to pick one; nothing guesses a gender for them.
--
-- The lists here must match GENDERS and SKIN_TONES in src/lib/profile.js.
-- The check keeps a typo out of the column, because the value becomes part
-- of a file name and a wrong one would show a broken picture.

alter table public.profiles add column gender text
  check (gender in ('male', 'female'));
alter table public.profiles add column skin_tone text
  check (skin_tone in ('light', 'brown', 'dark-brown', 'darkest'));

-- Column grants add up rather than replace, so the four columns granted in
-- section 2 stay granted and these two join them.
grant update (gender, skin_tone) on public.profiles to authenticated;


-- ============================================================================
-- 14. Telegram notifications
-- ============================================================================
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


-- ============================================================================
-- 15. Interests a person has taken off their list
-- ============================================================================
-- The profile page offers a fixed list of interests (src/lib/profile.js) plus
-- anything the person types in. A suggestion they do not want can now be
-- taken off their own list with the cross on the tile.
--
-- It is remembered PER PERSON, not deleted: the fixed list belongs to
-- everybody, so one resident hiding 'Gardening' must not take it away from
-- their neighbours. Typing it back in the box brings it back for them.
--
-- Nothing checks the values. An entry that no longer matches anything in the
-- fixed list is simply ignored when the form is drawn, so renaming a
-- suggestion in lib/profile.js cannot break anyone's profile.

alter table public.profiles add column hidden_interests text[] not null default '{}';

-- Column grants add up rather than replace, so this joins the ones already
-- granted in sections 2 and 13.
grant update (hidden_interests) on public.profiles to authenticated;


-- ============================================================================
-- 16. The walking avatar in the navbar
-- ============================================================================
-- A resident may have their own avatar stroll along the top bar. Off for
-- everybody until they switch it on in Edit profile, because movement that
-- starts on its own has to be something people can turn off (WCAG 2.2.2).
--
-- src/stores/auth.js reads this column in PROFILE_COLUMNS, so a project
-- without it cannot load a profile at all and nobody can log in.

alter table public.profiles add column show_walker boolean not null default false;

grant update (show_walker) on public.profiles to authenticated;
