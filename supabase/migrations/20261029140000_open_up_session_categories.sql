-- ============================================================================
-- Skill Swaps: people can name their own kind of session  Owner: Clarence Tay
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)
--
-- "Host a session" now works like Interests on the profile page: the seven
-- suggestions are still offered, and anything else can be typed in. The old
-- check only allowed those seven, so a typed-in kind was refused on save.
--
-- WHAT IS GIVEN UP
-- The fixed list is what kept two people who teach the same thing filing it
-- under the same word. src/lib/skillSwapFormat.js now folds a typed-in kind
-- into one of the seven when it recognises it ('cooking' -> 'Cooking'), which
-- recovers most of that, but 'Baking' and 'Bakes' will still sit apart.
--
-- The length check stays, because category is shown on a tile and in the
-- filter list, and a paragraph pasted in there would break both.
--
-- help_requests keeps its own fixed list; this only changes skill_sessions.

alter table public.skill_sessions drop constraint skill_sessions_category_check;

alter table public.skill_sessions add constraint skill_sessions_category_check
  check (length(trim(category)) between 1 and 40);
