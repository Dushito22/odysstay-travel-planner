-- The feed computes, per house, its latest render and its red-flag count. On a cold cache those lookups
-- were most of a 3.3 s first load (Toscana, signed out: past the 3 s limit, so the page errored).
create index if not exists listing_images_listing_kind_idx on public.listing_images (listing_id, kind, created_at desc);
create index if not exists listing_red_flags_listing_idx on public.listing_red_flags (listing_id);
-- Region filters in display order, same shape as listings_open_feed_idx.
create index if not exists listings_region_feed_idx on public.listings (region, has_real_photo desc nulls last, score desc nulls last)
  where not is_scrap and not is_demo and status not in ('closed', 'withdrawn');
-- A little more room for signed-out visitors on a cold start (default 3 s).
alter role anon set statement_timeout = '8s';
analyze public.listings;
analyze public.listing_images;
analyze public.listing_red_flags;
