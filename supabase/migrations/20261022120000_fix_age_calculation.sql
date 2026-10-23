-- ============================================================================
-- Fix: people were counted a day early as 65 (senior) or 18 (adult)
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this whole file and press Run. (schema.sql already includes this fix
-- for new, empty projects.) Safe to run: it only replaces functions, no data
-- changes.
--
-- Why: the old checks compared age(birth_date) with an interval such as
-- '65 years'. Postgres counts a month as 30 days when comparing intervals, so
-- on some days just before a birthday "64 years 11 mons 30 days" counted as 65
-- years. The checks now compare whole years, using Singapore's date.

create or replace function public.age_in_years(birth_date date)
returns int
language sql
stable
set search_path = ''
as $$
  select extract(year from age((now() at time zone 'Asia/Singapore')::date, birth_date))::int
$$;

create or replace function public.age_group_for(birth_date date)
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

create or replace function public.guardian_status(p public.profiles)
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

create or replace function public.handle_new_user()
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

create or replace function public.accept_help_request(request_id uuid, physical_ok boolean default false)
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
  if active_count >= 2 then
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

grant execute on function public.age_in_years(date) to authenticated;

-- Check: someone born on 23 October 1961 is still an adult on 22 October 2026
-- select public.age_in_years(date '1961-10-23');   -- 64 until their birthday (Singapore time)
