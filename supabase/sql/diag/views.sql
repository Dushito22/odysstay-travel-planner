drop view if exists public.auction_region_stats; drop view if exists public.auction_lots;
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
