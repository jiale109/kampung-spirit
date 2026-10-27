-- ============================================================================
-- Help Board: where the help is needed                    Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.)

alter table public.help_requests add column location text;

-- Existing requests (demo and test data) have no place yet; use the requester's
-- block. The fallback keeps the check below happy if a block is blank.
update public.help_requests r
set location = coalesce(nullif(left(trim(p.block), 100), ''), 'Not given')
from public.profiles p
where p.id = r.requester_id and r.location is null;

alter table public.help_requests alter column location set not null;

alter table public.help_requests add constraint help_requests_location_check
  check (length(trim(location)) between 1 and 100);

-- The browser may write this column too (same rule as the other columns)
grant insert (location) on public.help_requests to authenticated;
grant update (location) on public.help_requests to authenticated;
