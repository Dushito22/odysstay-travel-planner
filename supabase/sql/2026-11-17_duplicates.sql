-- The same house from two sources (agency ad and court sale, or one lot on two auction sites) showed twice.
-- The worker now marks the extra copies duplicate_of the richest one; the feed leaves them out. Safe to re-run.
alter table public.listings add column if not exists duplicate_of uuid references public.listings(id) on delete set null;
create index if not exists listings_duplicate_of on public.listings (duplicate_of) where duplicate_of is not null;

-- Add the column to the end of the feed view (create or replace view may only append columns).
do $$
declare cols text;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'listing_feed' and column_name = 'duplicate_of') then
    return;
  end if;
  select string_agg(case column_name
      when 'latest_render_path' then 'l.render_path_cached as latest_render_path'
      when 'red_flag_count' then 'l.red_flags_cached as red_flag_count'
      when 'source_url' then 'd.url as source_url'
      when 'source_title' then 'd.title as source_title'
      when 'source_published_at' then 'd.published_at as source_published_at'
      when 'source_id' then 'd.source_id'
      when 'price_per_sqm' then 'case when l.price_eur is not null and l.surface_sqm > 10 and l.property_type <> ''land'' then round(l.price_eur / l.surface_sqm) end as price_per_sqm'
      when 'days_left' then 'case when coalesce(l.deadline_at, l.auction_at) is not null then (coalesce(l.deadline_at, l.auction_at) - current_date) end as days_left'
      else 'l.' || quote_ident(column_name) end, ', ' order by ordinal_position)
  into cols from information_schema.columns where table_schema = 'public' and table_name = 'listing_feed';
  execute 'create or replace view public.listing_feed with (security_invoker = on) as select ' || cols
    || ', l.duplicate_of from public.listings l left join public.documents d on d.id = l.document_id';
end $$;
grant select on public.listing_feed to anon, authenticated;
select count(*) as views_with_column from information_schema.columns where table_name = 'listing_feed' and column_name = 'duplicate_of';
