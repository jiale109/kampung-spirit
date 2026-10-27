-- ============================================================================
-- Help Board: an "Other" category                         Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)
--
-- The category check was written inline in schema.sql, so Postgres named it
-- help_requests_category_check. To see it yourself:
--   select conname from pg_constraint where conrelid = 'public.help_requests'::regclass and contype = 'c';
-- No "if exists" on purpose: if the name were different, this stops with an
-- error instead of leaving the old check in place.

alter table public.help_requests drop constraint help_requests_category_check;

alter table public.help_requests add constraint help_requests_category_check
  check (category in ('Tech', 'Grocery', 'Lifting', 'Translation', 'Companion Walk', 'Other'));

-- "Other" is not always physical: the requester ticks is_physical when it is.
-- is_physical_category() stays the same (only Lifting and Companion Walk).
