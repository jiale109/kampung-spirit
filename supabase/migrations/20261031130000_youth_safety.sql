-- ============================================================================
-- Help Board: keep youth helpers safe                        Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has schema.sql AND
-- 20261031120000_block_unsafe_request_text.sql (run that one first): SQL Editor
-- -> New query, paste this file and press Run. (schema.sql already includes
-- these changes for new, empty projects.) Safe to run: it adds one column with a
-- default and replaces functions. No saved data changes.
--
-- 1. More blocked text: asking a helper to keep secrets or come alone, and
--    contact details (phone numbers, emails, "whatsapp me" and so on).
-- 2. at_home: the requester ticks "This help is inside my home".
-- 3. accept_help_request(): under-18s cannot accept a request inside someone's
--    home, or one before 8 am or from 7 pm (Singapore time). Everything else in
--    the function is unchanged.


-- 1. More blocked text (the trigger help_requests_check_text already exists)
-- The phrases a request may not include. Must match src/lib/contentRules.js
-- (BLOCKED_PHRASES): small letters, single spaces and apostrophes only.
create or replace function public.blocked_phrases()
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
    -- Asking a helper to keep secrets or be alone
    'come alone', 'don''t tell your parents', 'dont tell your parents', 'don''t tell anyone',
    'our secret', 'keep this between us', 'keep it secret',
    'send me a photo', 'send me pics', 'send pics',
    -- Clearly offensive words
    'fuck', 'fucking', 'bitch', 'asshole', 'cheebye'
  ]
$$;

-- Contact details are not allowed in requests (people talk through the app).
-- Must match CONTACT_PHRASES in src/lib/contentRules.js.
create or replace function public.contact_phrases()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['whatsapp me', 'telegram me', 'add me on', 'dm me', 'instagram', 'snapchat']
$$;

-- The same check as checkText() in src/lib/contentRules.js, so a request sent
-- around the form is stopped too. Whole words only (\m and \M mark the start and
-- end of a word), so 'pay me' does not match 'pay medical bills'.

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
    raise exception 'Please keep contact details out of requests. Talk through the app instead.';
  end if;
  return new;
end;
$$;

revoke execute on function public.help_requests_check_text() from public, anon, authenticated;


-- 2. Help inside the requester's home
alter table public.help_requests add column at_home boolean not null default false;

-- The browser may write it, like the other request columns
grant insert (at_home), update (at_home) on public.help_requests to authenticated;


-- 3. Under-18 limits when accepting (the rest is the same as schema.sql section 5)
create or replace function public.accept_help_request(request_id uuid, physical_ok boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.help_requests;
  mine public.profile_private;
  active_count int;
begin
  select * into req from public.help_requests where id = request_id for update;
  if not found or req.status <> 'open' then
    raise exception 'Sorry, this request is no longer open.';
  end if;

  if req.requester_id = me then
    raise exception 'You cannot accept your own request.';
  end if;

  select * into mine from public.profile_private where id = me;
  if public.age_in_years(mine.birth_date) < 18 and mine.guardian_verified_at is null then
    raise exception 'Your parent or guardian needs to confirm your account before you can help.';
  end if;

  -- Under-18s: never inside someone's home, and only between 8 am and 7 pm
  -- (Singapore time). Must match minorLimit() in src/views/youth/YouthHelpBoardView.vue
  if public.age_in_years(mine.birth_date) < 18 then
    if req.at_home then
      raise exception 'For your safety, under-18s cannot help inside someone''s home.';
    end if;
    if (req.needed_at at time zone 'Asia/Singapore')::time < time '08:00'
       or (req.needed_at at time zone 'Asia/Singapore')::time >= time '19:00' then
      raise exception 'For your safety, under-18s can only help between 8 am and 7 pm.';
    end if;
  end if;

  select count(*) into active_count from public.help_requests
  where helper_id = me and status in ('accepted', 'pending_confirmation');
  if active_count >= 2 then
    raise exception 'You can only have 2 active tasks. Finish one first.';
  end if;

  if req.is_physical and public.age_group_for(mine.birth_date) = 'senior' and not physical_ok then
    raise exception 'This task needs physical effort. Please confirm you are comfortable doing it.';
  end if;

  update public.help_requests
  set status = 'accepted',
      helper_id = me,
      physical_warning_ack_at = case when req.is_physical and physical_ok then now() end
  where id = request_id;
end;
$$;
