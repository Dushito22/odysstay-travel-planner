-- What sellers tell Argo about a house, shared with every buyer who looks at it later. Only facts about
-- the house (availability, occupancy, costs, documents); never who asked, their budget or their offers.
create table if not exists public.listing_intel (
  id bigserial primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  fact_en text not null,
  fact_ru text,
  source text not null default 'seller',
  deal_id uuid references public.deals(id) on delete set null,
  learned_at timestamptz not null default now()
);
create index if not exists listing_intel_listing_idx on public.listing_intel (listing_id, learned_at desc);
alter table public.listing_intel enable row level security;

-- The public face of it: no deal or buyer attached.
create or replace view public.listing_intel_public as
  select listing_id, fact_en, fact_ru, source, learned_at from public.listing_intel;
grant select on public.listing_intel_public to anon, authenticated;

-- How many different buyers are following a house: open deals or saves in the last 60 days. A count only.
create or replace function public.listing_interest(target uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct u)::int from (
    select user_id as u from public.deals where listing_id = target and stage not in ('won', 'lost', 'withdrawn')
    union
    select user_id from public.saved_listings where listing_id = target and created_at > now() - interval '60 days'
  ) x;
$$;
grant execute on function public.listing_interest(uuid) to anon, authenticated;

-- A conversation can wait its turn (so one agency isn't crowded by several buyers), and a seller's reply
-- is logged as coming from the contact.
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.threads'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%waiting_reply%';
  if c is not null then execute format('alter table public.threads drop constraint %I', c); end if;
  alter table public.threads add constraint threads_status_check check (status in ('open', 'waiting_reply', 'needs_you', 'queued', 'closed'));
  select conname into c from pg_constraint where conrelid = 'public.deal_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%actor%';
  if c is not null then execute format('alter table public.deal_events drop constraint %I', c); end if;
  alter table public.deal_events add constraint deal_events_actor_check check (actor in ('user', 'agent', 'system', 'contact'));
end $$;
