-- ============================================================================
-- Help Board: a pin on the map for where to meet          Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)
--
-- The request form now chooses the meeting place like the hangout form does
-- (OneMap search or a tap on the map), so "View map" can show the saved pin
-- instead of guessing. location stays as the name people read.
--
-- Older requests have no pin, so both columns stay null for them. The app then
-- shows only the place name.

alter table public.help_requests add column latitude numeric;
alter table public.help_requests add column longitude numeric;

-- Both empty, or both inside Singapore (the same box as the hangouts check)
alter table public.help_requests add constraint help_requests_inside_singapore
  check (
    (latitude is null and longitude is null)
    or (latitude between 1.1 and 1.6 and longitude between 103.5 and 104.2)
  );

-- The browser may write these columns too (same rule as the other columns)
grant insert (latitude, longitude) on public.help_requests to authenticated;
grant update (latitude, longitude) on public.help_requests to authenticated;
