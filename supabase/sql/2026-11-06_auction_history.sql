-- The record of what court auctions actually do: every round, price cut, date change and closing,
-- written automatically whenever an auction listing is added or changes. Nobody publishes this;
-- after a few months it tells us how far each region's auctions really fall before they sell.
create table if not exists public.auction_history (
  id bigserial primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  court text,
  case_ref text,
  region text,
  comune text,
  sale_type text,
  event text not null check (event in ('seen', 'price', 'date', 'status')),
  price_eur numeric,
  min_offer_eur numeric,
  appraisal_eur numeric,
  status text,
  auction_at timestamptz,
  previous_auction_failed boolean,
  at timestamptz not null default now()
);
alter table public.auction_history enable row level security;
create index if not exists auction_history_case_idx on public.auction_history (court, case_ref, at);
create index if not exists auction_history_listing_idx on public.auction_history (listing_id, at);

create or replace function public.log_auction_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if new.sale_type is null or new.sale_type not like 'auction%' then return new; end if;
  if tg_op = 'INSERT' then ev := 'seen';
  elsif new.price_eur is distinct from old.price_eur or new.min_offer_eur is distinct from old.min_offer_eur then ev := 'price';
  elsif new.auction_at is distinct from old.auction_at then ev := 'date';
  elsif new.status is distinct from old.status then ev := 'status';
  else return new;
  end if;
  insert into public.auction_history (listing_id, court, case_ref, region, comune, sale_type, event, price_eur, min_offer_eur, appraisal_eur, status, auction_at, previous_auction_failed)
  values (new.id, new.court, new.case_ref, new.region, new.comune, new.sale_type, ev, new.price_eur, new.min_offer_eur, new.appraisal_eur, new.status, new.auction_at, new.previous_auction_failed);
  return new;
end $$;

drop trigger if exists listings_auction_history on public.listings;
create trigger listings_auction_history after insert or update on public.listings
  for each row execute function public.log_auction_change();

-- Start the record with every auction we already know about.
insert into public.auction_history (listing_id, court, case_ref, region, comune, sale_type, event, price_eur, min_offer_eur, appraisal_eur, status, auction_at, previous_auction_failed, at)
select id, court, case_ref, region, comune, sale_type, 'seen', price_eur, min_offer_eur, appraisal_eur, status, auction_at, previous_auction_failed, coalesce(created_at, now())
from public.listings l
where sale_type like 'auction%' and not exists (select 1 from public.auction_history h where h.listing_id = l.id);

-- One row per lot (court + case): how many rounds we've seen, first and latest price, how far it has fallen.
create or replace view public.auction_lots as
select court, case_ref, max(region) as region, max(comune) as comune,
  count(distinct auction_at) filter (where auction_at is not null) as rounds,
  (array_agg(price_eur order by coalesce(auction_at, at), at) filter (where price_eur is not null))[1] as first_price,
  (array_agg(price_eur order by coalesce(auction_at, at) desc, at desc) filter (where price_eur is not null))[1] as latest_price,
  max(appraisal_eur) as appraisal_eur,
  (array_agg(status order by at desc))[1] as latest_status,
  min(at) as first_seen, max(at) as last_change
from public.auction_history
where case_ref is not null and court is not null
group by court, case_ref;

-- By region: lots tracked, how many went to another round, and the average fall from the first price.
create or replace view public.auction_region_stats as
select region, count(*) as lots,
  count(*) filter (where rounds > 1) as relisted,
  round(avg(case when rounds > 1 and first_price > 0 then 100 * (1 - latest_price / first_price) end)::numeric, 1) as avg_fall_pct,
  round(avg(case when appraisal_eur > 0 and latest_price > 0 then 100 * (1 - latest_price / appraisal_eur) end)::numeric, 1) as avg_below_appraisal_pct
from public.auction_lots
where region is not null
group by region;

revoke all on public.auction_lots, public.auction_region_stats from anon, authenticated;
