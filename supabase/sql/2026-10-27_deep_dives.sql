-- Deep dives: the court documents of a listing are read only when someone stars it.
-- Search and browsing never read documents. The worker picks pending rows up within the hour.

create table if not exists public.deep_dives (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'no_text', 'no_document', 'error')),
  requested_at timestamptz not null default now(),
  done_at timestamptz,
  pages int,
  flags int,
  note text
);

alter table public.deep_dives enable row level security;
drop policy if exists "Deep dives are public" on public.deep_dives;
create policy "Deep dives are public" on public.deep_dives for select using (true);
grant select on public.deep_dives to anon, authenticated;

alter table public.listing_red_flags add column if not exists page int;
alter table public.listing_red_flags add column if not exists origin text not null default 'ai';
alter table public.listing_red_flags add column if not exists doc_url text;

create or replace function public.enqueue_deep_dive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.deep_dives (listing_id) values (new.listing_id)
  on conflict (listing_id) do update
    set status = 'pending', requested_at = now()
    where deep_dives.status = 'error';
  return new;
end $$;

drop trigger if exists saved_listing_deep_dive on public.saved_listings;
create trigger saved_listing_deep_dive after insert on public.saved_listings
  for each row execute function public.enqueue_deep_dive();

-- Listings whose appraisal report was already read count as done.
insert into public.deep_dives (listing_id, status, done_at)
select l.id, 'done', now()
from public.listings l join public.documents d on d.id = l.document_id
where d.meta->>'perizia' = 'read'
on conflict (listing_id) do nothing;

-- Listings starred before this existed.
insert into public.deep_dives (listing_id)
select distinct listing_id from public.saved_listings
on conflict (listing_id) do nothing;
