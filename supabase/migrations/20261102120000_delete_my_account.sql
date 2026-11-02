-- ============================================================================
-- Profile: delete my account                                Owner: Reuben Tham
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql section 17 already includes this
-- change for new, empty projects.)
--
-- The browser cannot delete a Supabase Auth user, so the Profile page calls
-- this function instead. It only ever deletes the person who is logged in.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Please log in again before deleting your account.';
  end if;

  -- Requests this person agreed to help with go back on the board, so the
  -- requester is not left waiting for someone who is gone
  update public.help_requests
     set status = 'open', helper_id = null, physical_warning_ack_at = null
   where helper_id = me and status in ('accepted', 'pending_confirmation');

  -- Removing the login removes the profile, and every table that points at
  -- the profile follows it ("on delete cascade" / "on delete set null")
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
