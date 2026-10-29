-- Condition of the property as a first-class search field: ruin, needs_work or ready.
-- Worked out from the listing text (Italian or English) by a trigger, so every collector gets it for free.
alter table public.listings add column if not exists condition text
  check (condition in ('ruin', 'needs_work', 'ready'));

create or replace function public.classify_condition(t text) returns text
language sql immutable as $$
  select case
    when t is null or length(t) < 3 then null
    when t ~* '(rudere|ruderi|diroccat|crollat|collabent|inagibil|da demolire|stato di abbandono|allo stato grezzo|al grezzo|\mruin|derelict|collaps)' then 'ruin'
    when t ~* '(da ristrutturare|da rinnovare|da sistemare|da riammodernare|da risistemare|da rifare|ristrutturazione|bisognos|rustico|da completare|in costruzione|necessit|lavori di|needs (renovation|work|restoration)|to renovate|to restore|fixer)' then 'needs_work'
    when t ~* '(ristrutturat|abitabile|buono stato|buone condizioni|ottimo stato|ottime condizioni|pronto|perfett|nuova costruzione|finemente|arredat|renovated|move-in|ready to)' then 'ready'
    else null end
$$;

create or replace function public.listings_set_condition() returns trigger
language plpgsql as $$
begin
  if new.condition is null then
    new.condition := public.classify_condition(coalesce(new.title_en, '') || ' ' || coalesce(new.summary_en, ''));
  end if;
  return new;
end $$;

drop trigger if exists listings_condition on public.listings;
create trigger listings_condition before insert or update of title_en, summary_en on public.listings
  for each row execute function public.listings_set_condition();

update public.listings set condition = public.classify_condition(coalesce(title_en, '') || ' ' || coalesce(summary_en, ''))
  where condition is null;

-- The feed view expands l.* when created, so recreate it to pick up the column.
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
     order by created_at desc limit 1) as latest_render_path
from public.listings l
left join public.documents d on d.id = l.document_id;
grant select on public.listing_feed to anon, authenticated;
