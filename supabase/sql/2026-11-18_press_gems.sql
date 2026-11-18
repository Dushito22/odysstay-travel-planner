-- Read-only: today's strongest cheap houses with photos, one compact line each (for the marketing drafts).
select string_agg(concat_ws('|', left(id::text, 8), comune, region, price_eur::int, surface_sqm::int, sale_type, coalesce(discount_pct::int, 0), score::int,
  coalesce(((omi_eur_m2_min + omi_eur_m2_max) / 2)::int, 0)), ';' order by score desc, price_eur) as g
from (select l.* from listings l where not l.is_demo and not l.is_scrap and l.duplicate_of is null and l.status not in ('closed', 'withdrawn')
  and l.score >= 85 and l.photo_urls is not null and jsonb_array_length(l.photo_urls) > 0 and l.price_eur between 8000 and 60000
  and l.property_type in ('house', 'rural_house', 'apartment') order by l.score desc, l.price_eur limit 18) x;
