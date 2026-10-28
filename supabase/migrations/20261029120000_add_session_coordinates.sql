-- ============================================================================
-- Skill Swaps: a pin on the map for the venue            Owner: Clarence Tay
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)
--
-- "Host a session" now chooses the venue the same way the hangout and help
-- request forms do: search OneMap, or tap the map. The Skill Swaps list can
-- then be filtered to one place, like the Hangouts page.
--
-- venue stays as the name people read. Sessions saved before today have no
-- pin, so both columns stay null for them and the list simply leaves them out
-- while a place filter is on.

alter table public.skill_sessions add column latitude numeric;
alter table public.skill_sessions add column longitude numeric;

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

-- The browser may write these columns too (same rule as the other columns)
grant insert (latitude, longitude) on public.skill_sessions to authenticated;
grant update (latitude, longitude) on public.skill_sessions to authenticated;
