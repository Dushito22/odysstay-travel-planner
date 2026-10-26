-- Court auctions (Portale Vendite Pubbliche) and market comparison.
-- Idempotent: safe to run more than once.

alter table public.listings
  add column if not exists external_id text,           -- e.g. 'pvp:4651670', one row per source record
  add column if not exists appraisal_eur numeric,      -- court expert's valuation (valore di stima)
  add column if not exists min_offer_eur numeric,      -- lowest valid offer (offerta minima)
  add column if not exists discount_pct numeric,       -- 0-100: how far the minimum offer sits below the appraisal
  add column if not exists court text,                 -- 'Tribunale di PERUGIA'
  add column if not exists case_ref text,              -- 'R.G.E. 43/2025, lotto 1'
  add column if not exists sale_mode text,             -- 'Asincrona Telematica', 'Presso il venditore', ...
  add column if not exists contacts jsonb not null default '[]'::jsonb,     -- [{role, name, email, phone}] as published for the sale
  add column if not exists attachments jsonb not null default '[]'::jsonb,  -- [{kind, name, url}] official documents
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;   -- official photos, hotlinked

create unique index if not exists listings_external_id_key on public.listings (external_id);
create index if not exists listings_score_idx on public.listings (score desc nulls last);
create index if not exists listings_price_idx on public.listings (price_eur);
create index if not exists listings_auction_idx on public.listings (auction_at);
create index if not exists listings_region_idx on public.listings (region);

-- The view expands l.* when created, so recreate it to pick up the new columns.
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

insert into public.sources (id, name, country, kind, homepage, description_en) values
  ('pvp', 'Portale delle Vendite Pubbliche', 'IT', 'court', 'https://pvp.giustizia.it',
   'The Ministry of Justice portal where every court-ordered property sale in Italy must be published.')
on conflict (id) do update set description_en = excluded.description_en;
