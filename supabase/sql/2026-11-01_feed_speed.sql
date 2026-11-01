-- The landing page timed out for signed-out visitors (3 s limit): has_real_photo and is_scrap were computed
-- per row in the view, so ordering by them read every listing. They are now stored columns with an index.
-- Auction consultants' ads on Immobiliare use banners ("Valutazione pre-asta", "risparmio del 88%"), not photos
-- of the house, so they don't count as real photos.
drop view if exists public.listing_feed;

alter table public.listings drop column if exists has_real_photo;
alter table public.listings drop column if exists is_scrap;
alter table public.listings add column has_real_photo boolean generated always as (
  coalesce(hero_image_path is not null
    and hero_image_path !~* '(giustizia\.it|astegiudiziarie|astetraprivati|notariato\.it)'
    and coalesce(sale_mode, '') !~* 'consultant', false)
) stored;
alter table public.listings add column is_scrap boolean generated always as (
  coalesce(sale_type is distinct from 'one_euro' and (
    (price_eur is not null and price_eur < 3000)
    or (property_type in ('house', 'apartment', 'rural_house') and surface_sqm is not null and surface_sqm < 25)
  ), false)
) stored;

create index if not exists listings_score_idx on public.listings (score desc nulls last);

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
     order by created_at desc limit 1) as latest_render_path
from public.listings l
left join public.documents d on d.id = l.document_id;
grant select on public.listing_feed to anon, authenticated;
analyze public.listings;

-- The open feed in display order, so the first screen reads a few index entries instead of the whole table.
-- "nulls last" on both keys to match the app's order exactly, or Postgres can't use it for sorting.
drop index if exists public.listings_photo_score_idx;
drop index if exists public.listings_open_feed_idx;
create index if not exists listings_open_feed_idx on public.listings (has_real_photo desc nulls last, score desc nulls last)
  where not is_scrap and not is_demo and status not in ('closed', 'withdrawn');
