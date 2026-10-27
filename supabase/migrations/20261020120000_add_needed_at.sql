-- ============================================================================
-- Help Board: when the help is needed                     Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)

alter table public.help_requests add column if not exists needed_at timestamptz;

-- Existing requests have no time yet; use the time they were posted
update public.help_requests set needed_at = created_at where needed_at is null;

alter table public.help_requests alter column needed_at set not null;

-- The browser may write this column too (same rule as the other columns)
grant insert (needed_at) on public.help_requests to authenticated;
grant update (needed_at) on public.help_requests to authenticated;
