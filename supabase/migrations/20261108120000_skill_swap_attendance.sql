

alter table public.skill_session_attendees
  add column if not exists attended boolean;

drop function if exists public.complete_skill_session(uuid);

-- The host says it happened and who came: the host and the people who came earn points
create or replace function public.complete_skill_session(swap_id uuid, attended_ids uuid[])
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

  if attended_ids is null or cardinality(attended_ids) = 0 then
    raise exception 'Please tick at least one person who came.';
  end if;

  -- Everyone ticked must have had a place (a null in the list fails this too)
  if exists (
    select 1 from unnest(attended_ids) as ticked(user_id)
    where not exists (
      select 1 from public.skill_session_attendees a
      where a.session_id = s.id and a.user_id = ticked.user_id
    )
  ) then
    raise exception 'Some of the people you ticked did not sign up for this session. Please reload the page and try again.';
  end if;

  update public.skill_session_attendees a
  set attended = (a.user_id = any(attended_ids))
  where a.session_id = s.id;

  update public.skill_sessions set status = 'completed' where id = s.id;

  pts := public.skill_swap_points(s.duration);

  insert into public.points_ledger (user_id, amount, reason)
  values (s.host_id, pts, 'Hosted skill swap: ' || s.title);

  insert into public.points_ledger (user_id, amount, reason)
  select a.user_id, pts, 'Joined skill swap: ' || s.title
  from public.skill_session_attendees a
  where a.session_id = s.id and a.attended;
end;
$$;

revoke execute on function public.complete_skill_session(uuid, uuid[]) from public, anon;
grant execute on function public.complete_skill_session(uuid, uuid[]) to authenticated;

-- Ask the API to see the new column and function straight away
notify pgrst, 'reload schema';
