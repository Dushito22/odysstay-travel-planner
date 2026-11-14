-- The feed view looked up, for every house in a list, its newest render and its red-flag count: 600 subqueries
-- per page load, several loads at once, and the database stalled (6 s for the first 48 houses). Both values now
-- live on the listing, kept current by triggers, and the view reads them straight. Safe to re-run.
alter table public.listings add column if not exists render_path_cached text;
alter table public.listings add column if not exists red_flags_cached bigint not null default 0;

update public.listings l set render_path_cached = r.p
from (select distinct on (listing_id) listing_id, storage_path as p from public.listing_images where kind = 'render' order by listing_id, created_at desc) r
where r.listing_id = l.id and l.render_path_cached is distinct from r.p;

update public.listings l set red_flags_cached = f.n
from (select listing_id, count(*) as n from public.listing_red_flags group by listing_id) f
where f.listing_id = l.id and l.red_flags_cached <> f.n;

create or replace function public.listing_render_cache() returns trigger language plpgsql security definer set search_path = public as $$
declare lid uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.listings set render_path_cached = (select storage_path from public.listing_images i where i.listing_id = lid and i.kind = 'render' order by created_at desc limit 1) where id = lid;
  return null;
end $$;
drop trigger if exists listing_render_cache on public.listing_images;
create trigger listing_render_cache after insert or update or delete on public.listing_images for each row execute function public.listing_render_cache();

create or replace function public.listing_flags_cache() returns trigger language plpgsql security definer set search_path = public as $$
declare lid uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.listings set red_flags_cached = (select count(*) from public.listing_red_flags f where f.listing_id = lid) where id = lid;
  return null;
end $$;
drop trigger if exists listing_flags_cache on public.listing_red_flags;
create trigger listing_flags_cache after insert or update or delete on public.listing_red_flags for each row execute function public.listing_flags_cache();

-- Same columns, same order (so nothing that depends on the view breaks); only the two lookups change.
do $$
declare cols text;
begin
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
    || ' from public.listings l left join public.documents d on d.id = l.document_id';
end $$;
grant select on public.listing_feed to anon, authenticated;
select (select count(*) from public.listings where render_path_cached is not null) as renders, (select count(*) from public.listings where red_flags_cached > 0) as flagged;
