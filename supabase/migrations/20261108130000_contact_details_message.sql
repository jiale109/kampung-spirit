-- ============================================================================
-- Help requests: a truthful message when contact details are blocked
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. Safe to run again. (schema.sql section 4
-- already includes this change for new, empty projects.)
--
-- The old message said "Talk through the app instead", but the app has no
-- way to message another person. The rule is unchanged; only the sentence
-- is. It says the real reason instead: requests are public.
--
-- This is help_requests_check_text() exactly as the youth safety migration
-- (20261031130000) left it, with that one sentence changed. The word lists
-- it reads (blocked_phrases, contact_phrases) are not touched. Must match the
-- message in src/components/RequestForm.vue.

create or replace function public.help_requests_check_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t text;
  phrase text;
begin
  -- Small letters, single spaces, and curly apostrophes as straight ones
  t := regexp_replace(replace(lower(new.title || ' ' || new.description || ' ' || new.location), '’', ''''),
                      '\s+', ' ', 'g');
  foreach phrase in array public.blocked_phrases() loop
    if t ~ ('\m' || phrase || '\M') then
      raise exception 'For everyone''s safety, requests cannot include "%". Please change it and try again.', phrase;
    end if;
  end loop;

  if t ~ '(^|[^0-9])(\+65 ?)?[689][0-9]{3}[ -]?[0-9]{4}([^0-9]|$)'
     or t ~ '[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+'
     or exists (select 1 from unnest(public.contact_phrases()) p where t ~ ('\m' || p || '\M')) then
    raise exception 'Please keep contact details out of requests. Everyone on the Help Board can see them.';
  end if;
  return new;
end;
$$;
