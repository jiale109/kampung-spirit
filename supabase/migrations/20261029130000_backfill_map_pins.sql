-- ============================================================================
-- Put the older requests and sessions on the map            Owner: Clarence Tay
-- ============================================================================
-- Run once, after 20261028120000_add_request_coordinates.sql and
-- 20261029120000_add_session_coordinates.sql.
--
-- WHY THIS IS NEEDED
-- Those two migrations added latitude and longitude but left them empty for
-- rows that already existed, and the earlier one filled location in from the
-- requester's block, which is only text. A row with a place NAME and no pin
-- cannot be drawn on the map or found by the "near here" filter, so all the
-- seed and test rows had quietly dropped off every map.
--
-- HOW ACCURATE THESE ARE
-- Only Eunos Community Club (1.332644, 103.915255) was checked against
-- OneMap. The rest are the same approximate values already used for the
-- hangouts in schema.sql section 11, repeated here so the whole estate agrees
-- with itself rather than scattering. They are good enough to cluster the
-- demo data in the right neighbourhood; they are NOT surveyed positions.
--
-- Anything this cannot recognise is deliberately LEFT WITHOUT A PIN. Guessing
-- a location for a real resident's request would send a neighbour to the
-- wrong block, which is worse than the page saying "not shown".
--
-- Safe to re-run: every statement only touches rows that still have no pin.

-- ---------------------------------------------------------------- help board

update public.help_requests set latitude = 1.332644, longitude = 103.915255
where latitude is null
  and (location ilike '%eunos cc%' or location ilike '%eunos community club%');

update public.help_requests set latitude = 1.3215, longitude = 103.9065
where latitude is null and location ilike '%community garden%';

update public.help_requests set latitude = 1.3245, longitude = 103.9085
where latitude is null and location ilike '%link park%';

update public.help_requests set latitude = 1.3197, longitude = 103.9030
where latitude is null and location ilike '%mrt%';

-- Covers 'Blk 412 Eunos Cres' and 'Void deck, Blk 412 Eunos Cres', which is
-- what the block backfill wrote into most of the older rows
update public.help_requests set latitude = 1.3200, longitude = 103.9035
where latitude is null
  and (location ilike '%eunos cres%' or location ilike '%eunos crescent%');

-- --------------------------------------------------------------- skill swaps

update public.skill_sessions set latitude = 1.332644, longitude = 103.915255
where latitude is null
  and (venue ilike '%eunos cc%' or venue ilike '%eunos community club%');

update public.skill_sessions set latitude = 1.3215, longitude = 103.9065
where latitude is null and venue ilike '%community garden%';

update public.skill_sessions set latitude = 1.3245, longitude = 103.9085
where latitude is null and venue ilike '%link park%';

update public.skill_sessions set latitude = 1.3197, longitude = 103.9030
where latitude is null and venue ilike '%mrt%';

update public.skill_sessions set latitude = 1.3200, longitude = 103.9035
where latitude is null
  and (venue ilike '%eunos cres%' or venue ilike '%eunos crescent%');

-- ------------------------------------------------------------------- check
-- What is still without a pin, so you know what the maps will leave out.
-- Nothing is changed by this; it is here to be read.

select 'help_requests' as table_name, count(*) as still_without_a_pin
from public.help_requests where latitude is null
union all
select 'skill_sessions', count(*)
from public.skill_sessions where latitude is null;
