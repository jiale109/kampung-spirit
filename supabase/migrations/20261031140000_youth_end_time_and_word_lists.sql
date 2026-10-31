-- ============================================================================
-- Help Board: under-18s must finish by 7 pm; fewer blocked words  Owner: Victoria Soh
-- ============================================================================
-- Run once on a project that already has 20261031130000_youth_safety.sql (run
-- that one first): SQL Editor -> New query, paste this file and press Run.
-- (schema.sql already includes these changes for new, empty projects.) Safe to
-- run: it only replaces functions, no data changes.
--
-- 1. accept_help_request(): an under-18's task must also END by 7 pm Singapore
--    time (needed_at + duration), not just start before it. Everything else in
--    the function is unchanged.
-- 2. Fewer false alarms: 'gift card' and 'cash only' are no longer blocked (the
--    form gives a reminder for 'gift card' instead), and 'instagram' and
--    'snapchat' are no longer treated as contact details. Must match
--    src/lib/contentRules.js. The trigger help_requests_check_text() calls these
--    functions, so it picks up the new lists without changing.


-- 1. Under-18s: start from 8 am and end by 7 pm
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
  -- (Singapore time), start to end. Must match minorLimit() in src/views/youth/YouthHelpBoardView.vue
  if public.age_in_years(mine.birth_date) < 18 then
    if req.at_home then
      raise exception 'For your safety, under-18s cannot help inside someone''s home.';
    end if;
    -- Start from 8 am, and end (start + duration) by 7 pm. Starting from 7 pm is
    -- refused too, so a late task that ends after midnight cannot slip through.
    if (req.needed_at at time zone 'Asia/Singapore')::time < time '08:00'
       or (req.needed_at at time zone 'Asia/Singapore')::time >= time '19:00'
       or ((req.needed_at + make_interval(mins => req.duration)) at time zone 'Asia/Singapore')::time > time '19:00' then
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


-- 2. The blocked and contact lists
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
    'transfer money', 'send money', 'paynow me', 'pay me', 'pay upfront',
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
  select array['whatsapp me', 'telegram me', 'add me on', 'dm me']
$$;
