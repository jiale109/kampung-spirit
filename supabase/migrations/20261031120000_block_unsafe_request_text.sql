-- ============================================================================
-- Help Board: block unsafe phrases in requests              Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this file and press Run. (schema.sql already includes this change for
-- new, empty projects.) Safe to run: it adds two functions and a trigger, and
-- does not change any data. Requests already saved are only checked again when
-- their title, details or place are edited.
--
-- A simple word filter, not AI moderation: posting or editing a request whose
-- title, details or place includes a blocked phrase (mostly scams asking for
-- OTPs, passwords or money) is refused with a plain message. The form checks
-- the same list first (src/lib/contentRules.js).

-- The phrases a request may not include. Must match src/lib/contentRules.js
-- (BLOCKED_PHRASES): small letters and single spaces only.
create function public.blocked_phrases()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    -- Asking for codes and passwords
    'send me your otp', 'tell me your otp', 'give me your otp', 'share your otp',
    'your singpass password', 'your bank password', 'your pin number',
    'bank account number', 'credit card number',
    -- Asking for money
    'transfer money', 'send money', 'paynow me', 'gift card', 'pay me', 'cash only', 'pay upfront',
    -- Clearly offensive words
    'fuck', 'fucking', 'bitch', 'asshole', 'cheebye'
  ]
$$;

-- The same check as checkText() in src/lib/contentRules.js, so a request sent
-- around the form is stopped too. Whole words only (\m and \M mark the start and
-- end of a word), so 'pay me' does not match 'pay medical bills'.
create function public.help_requests_check_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t text;
  phrase text;
begin
  t := regexp_replace(lower(new.title || ' ' || new.description || ' ' || new.location), '\s+', ' ', 'g');
  foreach phrase in array public.blocked_phrases() loop
    if t ~ ('\m' || phrase || '\M') then
      raise exception 'For everyone''s safety, requests cannot include "%". Please change it and try again.', phrase;
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.help_requests_check_text() from public, anon, authenticated;

create trigger help_requests_check_text
  before insert or update of title, description, location on public.help_requests
  for each row execute procedure public.help_requests_check_text();
