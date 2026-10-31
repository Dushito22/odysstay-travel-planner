-- Feed view: real photos first, junk lots hidden.
-- has_real_photo: a listing photo that is not a scanned court page.
-- is_scrap: a fractional share, a cellar or a box sold as a "house" (under 25 m²), or a lot under €3,000.
-- The €1 scheme is never scrap: its price is symbolic by design.
drop view if exists public.listing_feed;
create view public.listing_feed with (security_invoker = on) as
select
  l.*,
  d.url as source_url,
  d.title as source_title,
  d.published_at as source_published_at,
  d.source_id,
  case when l.price_eur is not null and l.surface_sqm > 10 and l.property_type <> 'land'
       then round(l.price_eur / l.surface_sqm) end as price_per_sqm,
  case when coalesce(l.deadline_at, l.auction_at) is not null
       then (coalesce(l.deadline_at, l.auction_at) - current_date) end as days_left,
  (select count(*) from public.listing_red_flags f where f.listing_id = l.id) as red_flag_count,
  (select storage_path from public.listing_images i where i.listing_id = l.id and i.kind = 'render'
     order by created_at desc limit 1) as latest_render_path,
  coalesce(l.hero_image_path is not null
    and l.hero_image_path !~* '(giustizia\.it|astegiudiziarie|astetraprivati|notariato\.it)', false) as has_real_photo,
  coalesce(l.sale_type is distinct from 'one_euro' and (
    (l.price_eur is not null and l.price_eur < 3000)
    or (l.property_type in ('house', 'apartment', 'rural_house') and l.surface_sqm is not null and l.surface_sqm < 25)
  ), false) as is_scrap
from public.listings l
left join public.documents d on d.id = l.document_id;
grant select on public.listing_feed to anon, authenticated;
