-- ============================================================================
-- Rewards: voucher spending, the wallet and the community bonus in Supabase
-- ============================================================================
-- Run once on a project that already has schema.sql: SQL Editor -> New query,
-- paste this whole file and press Run. (schema.sql already includes this for
-- new, empty projects, in section 10.) Safe to run again: tables, policies and
-- the trigger are only created if missing, functions are replaced, and the
-- voucher list is updated in place. No other data changes.
--
-- Why: spending points and the voucher wallet were saved only in the browser
-- (localStorage), so another device showed the old balance and no vouchers, and
-- clearing the browser refunded everything. The monthly community bonus was
-- decided in each browser, so it could be paid many times or never. Now
-- redeem_voucher() takes the points and creates the wallet row in one step, and
-- a trigger on points_ledger pays the bonus exactly once per Singapore month.

-- ----------------------------------------------------------------------------
-- Vouchers (the shop). Costs MUST match src/lib/vouchers.js, or the page shows
-- one price and the database charges another.
-- ----------------------------------------------------------------------------
create table if not exists public.vouchers (
  id text primary key,
  title text not null,
  merchant text not null,
  cost int not null check (cost > 0)
);

insert into public.vouchers (id, title, merchant, cost) values
  ('v1', '$2 off any purchase', '7-Eleven', 50),
  ('v2', '$5 Grocery Voucher', 'FairPrice', 150),
  ('v3', 'Free Kopi / Teh with Toast', 'Kimly Kopitiam', 30),
  ('v4', '$10 Grocery Voucher', 'Cold Storage', 250),
  ('v5', '$5 wellness & medicine discount', 'Unity Pharmacy', 140),
  ('v7', '$3 Guardian Voucher', 'Guardian', 80)
on conflict (id) do update set title = excluded.title, merchant = excluded.merchant, cost = excluded.cost;

alter table public.vouchers enable row level security;

drop policy if exists "Logged-in users can see vouchers" on public.vouchers;
create policy "Logged-in users can see vouchers"
  on public.vouchers for select to authenticated
  using (true);

revoke insert, update, delete on public.vouchers from anon, authenticated;
grant select on public.vouchers to authenticated;

-- Bonus rows are marked, so they are not counted towards the challenge and
-- never pay the bonus again. Existing functions leave it at the default.
alter table public.points_ledger add column if not exists is_bonus boolean not null default false;

-- ----------------------------------------------------------------------------
-- Wallet: the vouchers each person has redeemed
-- ----------------------------------------------------------------------------
create table if not exists public.wallet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  voucher_id text not null references public.vouchers(id),
  code text not null unique,
  redeemed_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists wallet_items_user_id_idx on public.wallet_items (user_id);

alter table public.wallet_items enable row level security;

drop policy if exists "See your own vouchers" on public.wallet_items;
create policy "See your own vouchers"
  on public.wallet_items for select to authenticated
  using (user_id = (select auth.uid()));

-- Redeeming and marking as used go through the functions below
revoke insert, update, delete on public.wallet_items from anon, authenticated;
grant select on public.wallet_items to authenticated;

-- Spend points on a voucher. The points and the wallet row are saved together
-- (one function, one transaction), so points are never taken without a voucher.
create or replace function public.redeem_voucher(voucher_id text)
returns public.wallet_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v public.vouchers;
  balance int;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  item public.wallet_items;
  tries int := 0;
begin
  -- One redeem at a time per person, so two quick presses cannot both pass the balance check
  perform 1 from public.profiles where id = me for update;

  select * into v from public.vouchers where id = redeem_voucher.voucher_id;
  if not found then
    raise exception 'Sorry, this voucher could not be found.';
  end if;

  select coalesce(sum(amount), 0)::int into balance from public.points_ledger where user_id = me;
  if balance < v.cost then
    raise exception 'You need % points, but you only have % points.', v.cost, balance;
  end if;

  insert into public.points_ledger (user_id, amount, reason)
  values (me, -v.cost, 'Redeemed voucher: ' || v.title || ' (' || v.merchant || ')');

  -- 'KS-' and 5 random characters; try again on the rare clash with an existing code
  loop
    tries := tries + 1;
    new_code := 'KS-';
    for i in 1..5 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.wallet_items (user_id, voucher_id, code)
      values (me, v.id, new_code)
      returning * into item;
      exit;
    exception when unique_violation then
      if tries >= 10 then
        raise exception 'Sorry, something went wrong. Please try again.';
      end if;
    end;
  end loop;

  return item;
end;
$$;

-- Mark one of your own vouchers as used
create or replace function public.mark_voucher_used(item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wallet_items
  set used_at = now()
  where id = item_id and user_id = auth.uid() and used_at is null;
  if not found then
    raise exception 'This voucher is already used or is not yours.';
  end if;
end;
$$;

revoke execute on function
  public.redeem_voucher(text),
  public.mark_voucher_used(uuid)
from public, anon;

grant execute on function
  public.redeem_voucher(text),
  public.mark_voucher_used(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Community challenge (months are Singapore months)
-- ----------------------------------------------------------------------------

-- One row per month the bonus has been paid, so it is paid exactly once.
-- No browser access at all: RLS on and no policies.
create table if not exists public.community_bonus_paid (
  month date primary key,
  paid_at timestamptz not null default now()
);

alter table public.community_bonus_paid enable row level security;
revoke all on public.community_bonus_paid from anon, authenticated;

-- Points earned by everyone this month, not counting bonuses
create or replace function public.community_points_this_month()
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::int
  from public.points_ledger
  where amount > 0
    and not is_bonus
    and date_trunc('month', created_at at time zone 'Asia/Singapore')
      = date_trunc('month', now() at time zone 'Asia/Singapore');
$$;

revoke execute on function public.community_points_this_month() from public, anon;
grant execute on function public.community_points_this_month() to authenticated;

-- When earned points push the month past the target, pay every contributor
-- this month a bonus, once. 10000 and 50 MUST match COMMUNITY_TARGET and
-- COMMUNITY_BONUS in src/lib/points.js. Bonus rows have is_bonus = true, so
-- they never fire the bonus again.
create or replace function public.pay_community_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_month date := date_trunc('month', now() at time zone 'Asia/Singapore')::date;
  paid_month date;
begin
  if new.amount <= 0 or new.is_bonus then
    return null;
  end if;

  if public.community_points_this_month() < 10000 then
    return null;
  end if;

  -- Only the first insert that gets here adds the row; everyone else gets nothing back
  insert into public.community_bonus_paid (month) values (this_month)
  on conflict do nothing
  returning month into paid_month;
  if paid_month is null then
    return null;
  end if;

  insert into public.points_ledger (user_id, amount, reason, is_bonus)
  select distinct pl.user_id, 50, 'Community Challenge bonus (' || to_char(this_month, 'Mon YYYY') || ')', true
  from public.points_ledger pl
  where pl.amount > 0
    and not pl.is_bonus
    and date_trunc('month', pl.created_at at time zone 'Asia/Singapore')::date = this_month;

  return null;
end;
$$;

revoke execute on function public.pay_community_bonus() from public, anon, authenticated;

drop trigger if exists pay_community_bonus on public.points_ledger;
create trigger pay_community_bonus
  after insert on public.points_ledger
  for each row execute procedure public.pay_community_bonus();

-- Make the new tables and functions visible to the API straight away
notify pgrst, 'reload schema';
