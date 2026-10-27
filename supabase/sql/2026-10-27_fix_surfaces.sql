-- Floor areas that are really land or a whole estate (a 2,000 m² "apartment") gave absurd renovation
-- estimates. Clear the surface and the default estimate above a believable size per type.
with bad as (
  select id from public.listings
  where surface_sqm is not null and (
    (property_type = 'apartment' and surface_sqm > 400) or
    (property_type = 'house' and surface_sqm > 1200) or
    (property_type = 'rural_house' and surface_sqm > 1500) or
    (property_type in ('building', 'mixed', 'commercial') and surface_sqm > 3000)
  )
), d1 as (
  delete from public.cost_estimates c using bad where c.listing_id = bad.id and c.user_id is null returning 1
), d2 as (
  delete from public.listing_facts f using bad where f.listing_id = bad.id and f.key = 'surface_sqm' returning 1
)
update public.listings l set surface_sqm = null from bad where l.id = bad.id;
