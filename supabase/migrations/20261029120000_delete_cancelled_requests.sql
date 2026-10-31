-- ============================================================================
-- Help Board: delete your own cancelled requests            Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)
--
-- A requester may delete their own request from the Past list on My Requests,
-- but only once it is cancelled. Completed requests stay, because the helper's
-- record and points history depend on them.

create policy "Delete your own cancelled request"
  on public.help_requests for delete to authenticated
  using (requester_id = (select auth.uid()) and status = 'cancelled');

-- The policy above decides which rows; this lets the browser ask at all
grant delete on public.help_requests to authenticated;
