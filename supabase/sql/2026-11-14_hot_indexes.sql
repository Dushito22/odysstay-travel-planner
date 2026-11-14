-- Measured on 14 Nov: cost_estimates had no index on listing_id, so every house page scanned all 135k rows
-- (2 s each, zero index scans in 19 days). Deal pages read events, threads and contacts the same way.
create index if not exists cost_estimates_listing_user_idx on public.cost_estimates (listing_id, user_id);
create index if not exists deal_events_deal_idx on public.deal_events (deal_id, created_at desc);
create index if not exists threads_deal_idx on public.threads (deal_id);
create index if not exists contacts_org_comune_idx on public.contacts (organisation, comune);
create index if not exists deals_user_stage_idx on public.deals (user_id, stage);
-- The worker's lookups that scanned listings end to end.
create index if not exists listings_geocode_todo_idx on public.listings (id) where lat is null and comune is not null and not is_demo;
create index if not exists listings_external_id_pattern_idx on public.listings (external_id text_pattern_ops);
analyze public.cost_estimates;
analyze public.deal_events;
analyze public.threads;
analyze public.contacts;
-- Start the statistics fresh so the next health check shows the effect.
select extensions.pg_stat_statements_reset();
select count(*) as indexes from pg_indexes where indexname in ('cost_estimates_listing_user_idx','deal_events_deal_idx','threads_deal_idx','contacts_org_comune_idx','deals_user_stage_idx','listings_geocode_todo_idx','listings_external_id_pattern_idx');
