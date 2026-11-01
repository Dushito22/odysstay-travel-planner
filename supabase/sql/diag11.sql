drop index if exists public.listings_photo_score_idx;
drop index if exists public.listings_open_feed_idx;
create index listings_open_feed_idx on public.listings (has_real_photo desc nulls last, score desc nulls last)
  where not is_scrap and not is_demo and status not in ('closed', 'withdrawn');
