create index if not exists listings_open_feed_idx on public.listings (has_real_photo desc, score desc nulls last)
  where not is_scrap and not is_demo and status not in ('closed', 'withdrawn');
