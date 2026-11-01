begin;
set local role anon;
explain
select id from public.listing_feed
where status not in ('closed','withdrawn') and sale_type not in ('concession','lease')
  and property_type in ('house','rural_house','apartment','building') and is_scrap = false and is_demo = false
order by has_real_photo desc nulls last, score desc nulls last limit 6;
rollback;
