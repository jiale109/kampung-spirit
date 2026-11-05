-- ============================================================================
-- Hangouts can be anywhere, not only a known hotspot
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 11
-- already includes this change for new, empty projects; this file is a copy
-- of it, because that section never had a migration of its own.)
--
-- Without it, proposing a hangout (and pnpm seed:demo) fails with
-- 'null value in column "place_name"' on a project that has the columns, or
-- 'column "place_name" does not exist' on one that does not.
--
-- Hosts may search OneMap for any place in Singapore. Every hangout keeps its
-- OWN name and coordinates, even when a known hotspot was chosen, so the card
-- and the map never have to look anything up in src/lib/hotspots.js.
-- hotspot_id stays, but only as a tag for the "filter by place" dropdown, and
-- is null for a place that was searched for. outdoor is set by the host and
-- decides whether the rain warning is shown.

alter table public.hangouts add column if not exists place_name text;
alter table public.hangouts add column if not exists latitude numeric;
alter table public.hangouts add column if not exists longitude numeric;
alter table public.hangouts add column if not exists outdoor boolean not null default false;

-- Fill in the hangouts that already exist, using the same values as
-- src/lib/hotspots.js. Only rows still without a place are touched.
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
-- name, so no row is left half filled in
update public.hangouts set place_name = hotspot_id where place_name is null;
update public.hangouts set latitude = 1.332644, longitude = 103.915255
  where latitude is null or longitude is null;

-- Now every row has a place, so these can be required from here on
-- (setting not null again, or dropping it again, is harmless)
alter table public.hangouts alter column place_name set not null;
alter table public.hangouts alter column latitude set not null;
alter table public.hangouts alter column longitude set not null;
alter table public.hangouts alter column hotspot_id drop not null;

-- A name people can read, and coordinates that are actually in Singapore
alter table public.hangouts drop constraint if exists hangouts_place_name_not_blank;
alter table public.hangouts add constraint hangouts_place_name_not_blank
  check (length(trim(place_name)) >= 3);
alter table public.hangouts drop constraint if exists hangouts_inside_singapore;
alter table public.hangouts add constraint hangouts_inside_singapore
  check (latitude between 1.1 and 1.6 and longitude between 103.5 and 104.2);

-- The browser may write the new columns too (status still goes through the
-- hangout functions)
grant insert (title, description, hotspot_id, place_name, latitude, longitude, outdoor,
              hangout_date, hangout_time, duration)
  on public.hangouts to authenticated;
