-- ============================================================================
-- Demo data for a video recording: requests, hangouts and skill swaps that
-- start TODAY and TOMORROW (Singapore time)
-- ============================================================================
-- The app (and the database) refuse hangouts and skill swaps less than 24
-- hours away, and more than 3 requests a day per person. For a recording we
-- want things happening soon, so this switches those few rules off, adds the
-- rows, and switches them straight back on - all in ONE transaction, so if
-- anything goes wrong nothing is saved and every rule is back as it was.
--
-- Needs the demo accounts from `pnpm seed:demo` (demo.tan@example.com and
-- friends). Run it in SQL Editor -> New query -> paste all of it -> Run.
-- Running it twice adds a second copy; the clean-up at the very bottom
-- removes everything this added.
--
-- Not for real use: real residents' posts should always go through the app.

begin;

-- 1. The rules that would refuse demo times, off for this transaction only
alter table public.hangouts disable trigger hangouts_check_advance_notice;
alter table public.skill_sessions disable trigger skill_sessions_check;
alter table public.help_requests disable trigger help_requests_daily_limit;
alter table public.help_requests disable trigger help_requests_check_time;

-- 2. Help requests. Points are still worked out by the database (fill_in).
--    "base" is the next whole hour in Singapore, so every time reads neatly.
with base as (select date_trunc('hour', now() at time zone 'Asia/Singapore') + interval '1 hour' as at),
who as (
  select
    (select id from auth.users where email = 'demo.tan@example.com') as tan,
    (select id from auth.users where email = 'demo.lim@example.com') as lim,
    (select id from auth.users where email = 'demo.fatimah@example.com') as fatimah,
    (select id from auth.users where email = 'demo.weijie@example.com') as weijie,
    (select id from auth.users where email = 'demo.aisha@example.com') as aisha
)
insert into public.help_requests
  (requester_id, title, description, category, difficulty, duration, needed_at, location, latitude, longitude, status, helper_id)
select v.requester, v.title, v.description, v.category, v.difficulty, v.duration,
       (base.at + v.starts) at time zone 'Asia/Singapore', v.location, v.lat, v.lng, v.status, v.helper
from base, who, lateral (values
  -- Open, waiting for a helper
  (who.tan, 'Help me book a polyclinic appointment online', 'The clinic told me to book on my phone but I do not know how. Please show me slowly.',
   'Tech', 'Medium', 45, interval '2 hours', 'Void deck of Blk 412 Eunos Crescent', 1.3212, 103.9025, 'open', null::uuid),
  (who.lim, 'Pick up my medicine from the pharmacy', 'My medicine is ready at the pharmacy near the MRT. I will give you the slip when you arrive.',
   'Grocery', 'Easy', 30, interval '4 hours', 'Blk 410 Eunos Crescent lift lobby', 1.3205, 103.9030, 'open', null::uuid),
  (who.fatimah, 'Walk with me to the wet market', 'I walk slowly and the road is busy. I would like some company there and back.',
   'Companion Walk', 'Easy', 60, interval '1 day', 'Blk 415 Eunos Crescent void deck', 1.3218, 103.9040, 'open', null::uuid),
  (who.lim, 'Help me move a mattress to my bedroom', 'A new mattress has been delivered to my living room and I cannot move it alone.',
   'Lifting', 'Hard', 30, interval '1 day 3 hours', 'Blk 410 Eunos Crescent void deck', 1.3205, 103.9030, 'open', null::uuid),
  (who.tan, 'Explain a bank letter to me in Mandarin', 'My bank sent me a letter in English and I want to understand what it says.',
   'Translation', 'Easy', 30, interval '1 day 5 hours', 'Eunos Community Club lobby', 1.332644, 103.915255, 'open', null::uuid),
  -- Already accepted by Wei Jie, later today
  (who.fatimah, 'Set up WhatsApp on my new phone', 'I have a new phone and want WhatsApp on it so my family can message me.',
   'Tech', 'Easy', 30, interval '3 hours', 'Blk 415 Eunos Crescent void deck', 1.3218, 103.9040, 'accepted', who.weijie),
  -- Aisha says it is done; Mdm Tan has to confirm (an earlier time today).
  -- Not Wei Jie, so he has 1 of his 2 task places free to accept one on camera.
  (who.tan, 'Change the light bulb in my kitchen', 'The kitchen light has gone out and I cannot climb the ladder safely any more.',
   'Other', 'Easy', 15, interval '-1 hour', 'Blk 412 Eunos Crescent', 1.3212, 103.9025, 'pending_confirmation', who.aisha)
) as v(requester, title, description, category, difficulty, duration, starts, location, lat, lng, status, helper);

-- 3. Hangouts (the host is added as going by the database, as usual)
with base as (select date_trunc('hour', now() at time zone 'Asia/Singapore') + interval '1 hour' as at),
who as (
  select
    (select id from auth.users where email = 'demo.tan@example.com') as tan,
    (select id from auth.users where email = 'demo.weijie@example.com') as weijie,
    (select id from auth.users where email = 'demo.aisha@example.com') as aisha
)
insert into public.hangouts
  (host_id, title, description, place_name, latitude, longitude, outdoor, hangout_date, hangout_time, duration)
select v.host, v.title, v.description, v.place, v.lat, v.lng, v.outdoor,
       (base.at + v.starts)::date, (base.at + v.starts)::time, v.duration
from base, who, lateral (values
  (who.tan, 'Kopi and chit-chat', 'Kopi and a chat with the neighbours. Come and go as you like.',
   'Eunos Crescent Market and Food Centre', 1.32, 103.9035, false, interval '2 hours', 60),
  (who.weijie, 'Mahjong afternoon at the CC', 'Friendly mahjong, no money involved. Beginners are very welcome and we will teach you.',
   'Eunos Community Club', 1.332644, 103.915255, false, interval '5 hours', 120),
  (who.aisha, 'Evening walk at the park', 'A gentle walk and a chat. We stop whenever anyone needs a rest.',
   'Eunos Link Park', 1.3245, 103.9085, true, interval '1 day', 60)
) as v(host, title, description, place, lat, lng, outdoor, starts, duration);

-- A few neighbours going, so the cards show people
insert into public.hangout_attendees (hangout_id, user_id)
select h.id, u.id
from public.hangouts h
join auth.users u on u.email in ('demo.lim@example.com', 'demo.fatimah@example.com')
where h.title in ('Kopi and chit-chat', 'Mahjong afternoon at the CC')
  and h.status = 'open'
  and h.created_at > now() - interval '1 minute'
on conflict do nothing;

-- 4. Skill swaps
with base as (select date_trunc('hour', now() at time zone 'Asia/Singapore') + interval '1 hour' as at),
who as (
  select
    (select id from auth.users where email = 'demo.tan@example.com') as tan,
    (select id from auth.users where email = 'demo.weijie@example.com') as weijie,
    (select id from auth.users where email = 'demo.aisha@example.com') as aisha
)
insert into public.skill_sessions
  (host_id, title, description, category, venue, latitude, longitude, session_date, session_time, duration, capacity)
select v.host, v.title, v.description, v.category, v.venue, v.lat, v.lng,
       (base.at + v.starts)::date, (base.at + v.starts)::time, v.duration, v.capacity
from base, who, lateral (values
  (who.weijie, 'Spotting scam messages on your phone', 'See real examples of scam SMS and calls, and learn what to do when one arrives.',
   'Tech', 'Eunos Community Club, Level 2', 1.332644, 103.915255, interval '3 hours', 60, 6),
  (who.tan, 'Knitting a simple scarf', 'Learn to cast on and knit a few rows of your own scarf. Needles and wool are provided.',
   'Crafts', 'Void deck, Blk 412 Eunos Crescent', 1.3212, 103.9025, interval '1 day 1 hour', 90, 8),
  (who.aisha, 'Easy Malay phrases for the market', 'Greetings, numbers and the phrases you need at the market and the coffee shop.',
   'Languages', 'Eunos Community Club, Level 1', 1.332644, 103.915255, interval '1 day 4 hours', 60, 10)
) as v(host, title, description, category, venue, lat, lng, starts, duration, capacity);

insert into public.skill_session_attendees (session_id, user_id)
select s.id, u.id
from public.skill_sessions s
join auth.users u on u.email in ('demo.lim@example.com', 'demo.fatimah@example.com')
where s.title in ('Spotting scam messages on your phone', 'Knitting a simple scarf')
  and s.status = 'open'
  and s.created_at > now() - interval '1 minute'
on conflict do nothing;

-- 5. Every rule back on
alter table public.hangouts enable trigger hangouts_check_advance_notice;
alter table public.skill_sessions enable trigger skill_sessions_check;
alter table public.help_requests enable trigger help_requests_daily_limit;
alter table public.help_requests enable trigger help_requests_check_time;

commit;

-- 6. Check: should list 7 requests, 3 hangouts and 3 skill swaps
select 'request' as kind, title, status, (needed_at at time zone 'Asia/Singapore')::text as starts
from public.help_requests where created_at > now() - interval '5 minutes'
union all
select 'hangout', title, status, (hangout_date + hangout_time)::text
from public.hangouts where created_at > now() - interval '5 minutes'
union all
select 'skill swap', title, status, (session_date + session_time)::text
from public.skill_sessions where created_at > now() - interval '5 minutes'
order by kind, starts;


-- ============================================================================
-- POINTS for showing voucher redemption (optional, run on its own)
-- ============================================================================
-- 500 points to each demo account: enough for any voucher (they cost 30 to
-- 250) and a second one. Ordinary earned points, so they count towards the
-- monthly 10,000-point Community Challenge like any others. If they take the
-- month past 10,000, the bonus is paid to everyone who earned points this
-- month, exactly as it would be for real points (and only once a month).

-- First, how far this month is from the goal (2,500 is about to be added)
select public.community_points_this_month() as points_this_month;

insert into public.points_ledger (user_id, amount, reason)
select id, 500, 'Demo points for the video'
from auth.users
where email in ('demo.tan@example.com', 'demo.lim@example.com', 'demo.fatimah@example.com',
                'demo.weijie@example.com', 'demo.aisha@example.com');

-- Check the balances
select u.email, coalesce(sum(p.amount), 0) as points
from auth.users u
left join public.points_ledger p on p.user_id = u.id
where u.email like 'demo.%@example.com'
group by u.email
order by u.email;


-- ============================================================================
-- PAST SKILL SWAPS HOSTED BY BOB, for showing "who came" and the points
-- (optional, run on its own)
-- ============================================================================
-- Three sessions that have already happened, still open, with all five demo
-- accounts signed up. Log in as Bob, open Skill Swaps, press "Mark as
-- completed" on one, tick who came, and the host and everyone ticked earn
-- 30 points an hour (complete_skill_session, the skill swap attendance
-- migration). The database refuses sessions in the past, so that one rule is
-- off for this transaction only, as above.
--
-- Bob is found by his profile NAME. Run this first and check it lists
-- exactly one Bob; if your Bob has a different name (e.g. "Bob Tan"), change
-- 'Bob' below, here and in the block underneath, to match:
--   select p.name, u.email from public.profiles p join auth.users u on u.id = p.id
--   where p.name ilike 'bob%';

begin;

do $$
begin
  if (select count(*) from public.profiles where name ilike 'Bob') <> 1 then
    raise exception 'Expected exactly one account named Bob. Run the check above and fix the name.';
  end if;
end $$;

alter table public.skill_sessions disable trigger skill_sessions_check;

-- Yesterday morning, yesterday afternoon, and earlier today (all over by now)
with base as (select date_trunc('hour', now() at time zone 'Asia/Singapore') as at),
bob as (select id from public.profiles where name ilike 'Bob')
insert into public.skill_sessions
  (host_id, title, description, category, venue, latitude, longitude, session_date, session_time, duration, capacity)
select bob.id, v.title, v.description, v.category, v.venue, v.lat, v.lng,
       (base.at + v.starts)::date, (base.at + v.starts)::time, v.duration, 8
from base, bob, (values
  ('Cooking simple one-pot rice', 'Make a healthy one-pot chicken rice that is easy to cook for one or two people.',
   'Cooking', 'Eunos Community Club kitchen', 1.332644, 103.915255, interval '-26 hours', 90),
  ('Taking good photos on your phone', 'Simple tips for clear, bright photos of family and friends, and how to send them.',
   'Tech', 'Eunos Community Club, Level 2', 1.332644, 103.915255, interval '-22 hours', 60),
  ('Tai chi for beginners', 'Slow, gentle movements for balance and strength. Wear comfortable shoes.',
   'Health & fitness', 'Eunos Link Park', 1.3245, 103.9085, interval '-3 hours', 60)
) as v(title, description, category, venue, lat, lng, starts, duration);

-- All five demo accounts had a place in each
insert into public.skill_session_attendees (session_id, user_id)
select s.id, u.id
from public.skill_sessions s
join public.profiles bob on bob.id = s.host_id and bob.name ilike 'Bob'
join auth.users u on u.email in ('demo.tan@example.com', 'demo.lim@example.com', 'demo.fatimah@example.com',
                                 'demo.weijie@example.com', 'demo.aisha@example.com')
where s.title in ('Cooking simple one-pot rice', 'Taking good photos on your phone', 'Tai chi for beginners')
  and s.status = 'open'
  and s.created_at > now() - interval '1 minute'
on conflict do nothing;

alter table public.skill_sessions enable trigger skill_sessions_check;

commit;

-- Check: 3 sessions, each with 5 people
select s.title, (s.session_date + s.session_time) as started, s.status, count(a.user_id) as signed_up
from public.skill_sessions s
join public.profiles bob on bob.id = s.host_id and bob.name ilike 'Bob'
left join public.skill_session_attendees a on a.session_id = s.id
where s.title in ('Cooking simple one-pot rice', 'Taking good photos on your phone', 'Tai chi for beginners')
group by s.id
order by started;


-- ============================================================================
-- BOB HELPED MDM FATIMAH AND MR LIM: waiting for them to confirm
-- (optional, run on its own)
-- ============================================================================
-- Two requests from earlier today that Bob accepted and has marked as done.
-- Log in as Mdm Fatimah (then Mr Lim), open My Requests and press
-- "Yes, Bob helped me": the request is completed and Bob earns its points
-- (confirm_help_done). Uses the same Bob as the section above, found by name.
--
-- Note: requests waiting for a confirmation count towards Bob's 2 active
-- tasks, so he cannot accept another request until one is confirmed.

begin;

do $$
begin
  if (select count(*) from public.profiles where name ilike 'Bob') <> 1 then
    raise exception 'Expected exactly one account named Bob. Run the check in the section above and fix the name.';
  end if;
end $$;

-- The time has passed (they were this morning), and the 3-a-day limit is not
-- the point of the demo, so those two rules are off for this transaction only
alter table public.help_requests disable trigger help_requests_check_time;
alter table public.help_requests disable trigger help_requests_daily_limit;

with base as (select date_trunc('hour', now() at time zone 'Asia/Singapore') as at),
who as (
  select
    (select id from public.profiles where name ilike 'Bob') as bob,
    (select id from auth.users where email = 'demo.fatimah@example.com') as fatimah,
    (select id from auth.users where email = 'demo.lim@example.com') as lim
)
insert into public.help_requests
  (requester_id, helper_id, status, marked_done_at, title, description, category, difficulty, duration,
   needed_at, location, latitude, longitude)
select v.requester, who.bob, 'pending_confirmation', now() - interval '1 hour', v.title, v.description,
       v.category, v.difficulty, v.duration, (base.at + v.starts) at time zone 'Asia/Singapore',
       v.location, v.lat, v.lng
from base, who, lateral (values
  (who.fatimah, 'Fix the TV channels on my remote', 'My TV lost all its channels after a power cut and I cannot get them back.',
   'Tech', 'Easy', 30, interval '-4 hours', 'Blk 415 Eunos Crescent', 1.3218, 103.9040),
  (who.lim, 'Carry my shopping trolley up the stairs', 'The lift at my block is under repair and my trolley is too heavy for the stairs.',
   'Lifting', 'Medium', 15, interval '-3 hours', 'Blk 410 Eunos Crescent lift lobby', 1.3205, 103.9030)
) as v(requester, title, description, category, difficulty, duration, starts, location, lat, lng);

alter table public.help_requests enable trigger help_requests_check_time;
alter table public.help_requests enable trigger help_requests_daily_limit;

commit;

-- Check: 2 requests, waiting for confirmation, with Bob as the helper
select r.title, req.name as asked_by, h.name as helper, r.status, r.points
from public.help_requests r
join public.profiles req on req.id = r.requester_id
join public.profiles h on h.id = r.helper_id
where r.title in ('Fix the TV channels on my remote', 'Carry my shopping trolley up the stairs');


-- ============================================================================
-- CLEAN-UP after the recording (run on its own, it is not part of the above).
-- Removes only rows with these exact titles from the demo accounts. None of
-- them is used by pnpm seed:demo, so the seed's own events are left alone.
-- ============================================================================
-- delete from public.help_requests r using auth.users u
-- where r.requester_id = u.id and u.email like 'demo.%@example.com'
--   and r.title in ('Help me book a polyclinic appointment online', 'Pick up my medicine from the pharmacy',
--     'Walk with me to the wet market', 'Help me move a mattress to my bedroom', 'Explain a bank letter to me in Mandarin',
--     'Set up WhatsApp on my new phone', 'Change the light bulb in my kitchen');
-- delete from public.hangouts h using auth.users u
-- where h.host_id = u.id and u.email like 'demo.%@example.com'
--   and h.title in ('Kopi and chit-chat', 'Mahjong afternoon at the CC', 'Evening walk at the park');
-- delete from public.skill_sessions s using auth.users u
-- where s.host_id = u.id and u.email like 'demo.%@example.com'
--   and s.title in ('Spotting scam messages on your phone', 'Knitting a simple scarf', 'Easy Malay phrases for the market');
--
-- Bob's two requests from Mdm Fatimah and Mr Lim (points Bob earned from
-- them stay, as below):
-- delete from public.help_requests r using public.profiles bob
-- where r.helper_id = bob.id and bob.name ilike 'Bob'
--   and r.title in ('Fix the TV channels on my remote', 'Carry my shopping trolley up the stairs');
--
-- Bob's three past sessions. Points already paid for completing them stay
-- (they are the record of that); remove them too only if you want:
-- delete from public.skill_sessions s using public.profiles bob
-- where s.host_id = bob.id and bob.name ilike 'Bob'
--   and s.title in ('Cooking simple one-pot rice', 'Taking good photos on your phone', 'Tai chi for beginners');
--
-- And the demo points, with any vouchers redeemed during the recording (so
-- no one is left with a negative balance). Only rows from the demo accounts
-- made today. A Community Challenge bonus that the demo points set off is
-- NOT undone by this: it was paid to real residents too, and taking it back
-- is a decision for the team.
-- delete from public.wallet_items w using auth.users u
-- where w.user_id = u.id and u.email like 'demo.%@example.com'
--   and (w.redeemed_at at time zone 'Asia/Singapore')::date = (now() at time zone 'Asia/Singapore')::date;
-- delete from public.points_ledger p using auth.users u
-- where p.user_id = u.id and u.email like 'demo.%@example.com'
--   and (p.reason = 'Demo points for the video'
--        or (p.amount < 0 and p.reason like 'Redeemed voucher:%'
--            and (p.created_at at time zone 'Asia/Singapore')::date = (now() at time zone 'Asia/Singapore')::date));
