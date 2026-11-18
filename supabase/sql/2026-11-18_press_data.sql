-- Read-only: numbers for the press pitch and fresh houses for the marketing drafts.
with live as (
  select l.*, d.source_id from listings l left join documents d on d.id = l.document_id
  where not l.is_demo and not l.is_scrap and l.duplicate_of is null and l.status not in ('closed', 'withdrawn')
),
homes as (
  select * from live where property_type in ('house', 'rural_house', 'apartment', 'building') and price_eur >= 5000 and surface_sqm > 40
)
select json_build_object(
  'open_total', (select count(*) from live),
  'homes_photo_under_30k', (select count(*) from homes where price_eur < 30000 and photo_urls is not null and jsonb_array_length(photo_urls) > 0),
  'homes_photo_under_50k', (select count(*) from homes where price_eur < 50000 and photo_urls is not null and jsonb_array_length(photo_urls) > 0),
  'one_euro_open', (select count(*) from live where sale_type = 'one_euro'),
  'auctions_open', (select count(*) from live where sale_type like 'auction%'),
  'auctions_half_off', (select count(*) from live where sale_type like 'auction%' and discount_pct >= 50),
  'auction_median_discount', (select percentile_cont(0.5) within group (order by discount_pct) from live where sale_type like 'auction%' and discount_pct is not null),
  'homes_under_omi', (select json_build_object('n', count(*) filter (where price_eur / surface_sqm < (omi_eur_m2_min + omi_eur_m2_max) / 2), 'of', count(*))
     from homes where omi_eur_m2_min is not null and source_id = 'immobiliare'),
  'regions', (select json_agg(x order by x.med) from (select region, count(*) n, round(percentile_cont(0.5) within group (order by price_eur / surface_sqm))::int med,
       round(percentile_cont(0.5) within group (order by price_eur))::int med_price
     from homes where photo_urls is not null and jsonb_array_length(photo_urls) > 0 and region is not null group by region having count(*) >= 40) x),
  'gems', (select json_agg(y) from (select id, comune, region, price_eur, surface_sqm, property_type, sale_type, discount_pct, score, condition, omi_eur_m2_min, omi_eur_m2_max
     from live where score >= 85 and photo_urls is not null and jsonb_array_length(photo_urls) > 0 and price_eur between 8000 and 60000
     order by score desc, price_eur limit 14) y)
) as r;
