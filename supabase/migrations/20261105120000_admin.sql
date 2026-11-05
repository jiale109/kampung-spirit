-- ============================================================================
-- Admin: an account that can delete requests, hangouts and skill swaps
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 18
-- already includes this change for new, empty projects.)
--
-- The DATABASE decides who is an admin. The app hides buttons for everyone
-- else, but that is only for looks: every admin action below checks
-- public.is_admin() itself, so a non-admin calling it is refused here.
--
-- Admins are added by hand in the SQL Editor (see the line at the end).
-- Nothing in the app can read or write the admins table.

-- 1. Who is an admin. RLS on and no policies, and no grants: the app cannot
--    see or change it. Only the SQL Editor (and security definer functions)
--    can.
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 2. Is the person calling an admin? Used by the policies and functions below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3. The same, as a field on profiles (like guardian_status), so the app can
--    ask with select('..., is_admin'). True only on your OWN profile, and only
--    if you are an admin: nobody can find out who the admins are.
create or replace function public.is_admin(p public.profiles)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.id = (select auth.uid())
     and exists (select 1 from public.admins a where a.user_id = p.id)
$$;

revoke execute on function public.is_admin(public.profiles) from public, anon;
grant execute on function public.is_admin(public.profiles) to authenticated;

-- 4. Admins can see every request, hangout and session, whatever its status.
--    (Who is going to what is already readable by everyone logged in.)
drop policy if exists "Admins see all" on public.help_requests;
create policy "Admins see all"
  on public.help_requests for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins see all" on public.hangouts;
create policy "Admins see all"
  on public.hangouts for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins see all" on public.skill_sessions;
create policy "Admins see all"
  on public.skill_sessions for select to authenticated
  using (public.is_admin());

-- 5. Deleting, for admins only. Called with supabase.rpc('name', { ... }).
--    Attendee rows go with the hangout or session (on delete cascade), and
--    points_ledger.help_request_id is set to null, so points people have
--    already earned stay theirs.
create or replace function public.admin_delete_help_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.';
  end if;

  delete from public.help_requests r where r.id = admin_delete_help_request.request_id;
  if not found then
    raise exception 'We could not find that.';
  end if;
end;
$$;

create or replace function public.admin_delete_hangout(hangout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.';
  end if;

  delete from public.hangouts h where h.id = admin_delete_hangout.hangout_id;
  if not found then
    raise exception 'We could not find that.';
  end if;
end;
$$;

create or replace function public.admin_delete_skill_session(swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.';
  end if;

  delete from public.skill_sessions s where s.id = admin_delete_skill_session.swap_id;
  if not found then
    raise exception 'We could not find that.';
  end if;
end;
$$;

revoke execute on function public.admin_delete_help_request(uuid) from public, anon;
revoke execute on function public.admin_delete_hangout(uuid) from public, anon;
revoke execute on function public.admin_delete_skill_session(uuid) from public, anon;
grant execute on function public.admin_delete_help_request(uuid) to authenticated;
grant execute on function public.admin_delete_hangout(uuid) to authenticated;
grant execute on function public.admin_delete_skill_session(uuid) to authenticated;

-- 6. Admins look after the app; they do not take part in it.
--
--    Rather than copy accept_help_request, join_hangout and join_skill_session
--    here (each has been replaced by later migrations, and a stale copy would
--    quietly undo a newer rule), these triggers sit on the rows those
--    functions write. Every existing rule stays exactly as it is.
--      - posting a request, proposing a hangout, hosting a session: the insert
--      - accepting a request: setting helper_id
--      - joining a hangout or session: adding an attendee row
create or replace function public.block_admin_taking_part()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    raise exception 'Admin accounts cannot take part.';
  end if;
  return new;
end;
$$;

drop trigger if exists help_requests_no_admin on public.help_requests;
create trigger help_requests_no_admin
  before insert on public.help_requests
  for each row execute function public.block_admin_taking_part();

drop trigger if exists help_requests_no_admin_helper on public.help_requests;
create trigger help_requests_no_admin_helper
  before update of helper_id on public.help_requests
  for each row
  when (new.helper_id is not null and new.helper_id is distinct from old.helper_id)
  execute function public.block_admin_taking_part();

drop trigger if exists hangouts_no_admin on public.hangouts;
create trigger hangouts_no_admin
  before insert on public.hangouts
  for each row execute function public.block_admin_taking_part();

drop trigger if exists hangout_attendees_no_admin on public.hangout_attendees;
create trigger hangout_attendees_no_admin
  before insert on public.hangout_attendees
  for each row execute function public.block_admin_taking_part();

drop trigger if exists skill_sessions_no_admin on public.skill_sessions;
create trigger skill_sessions_no_admin
  before insert on public.skill_sessions
  for each row execute function public.block_admin_taking_part();

drop trigger if exists skill_session_attendees_no_admin on public.skill_session_attendees;
create trigger skill_session_attendees_no_admin
  before insert on public.skill_session_attendees
  for each row execute function public.block_admin_taking_part();

-- 7. To make the demo admin (created by pnpm seed:demo) an admin, run this
--    once in the SQL Editor. It is a comment on purpose: nothing here makes
--    anyone an admin by itself.
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'admin@example.com'
--   on conflict do nothing;
