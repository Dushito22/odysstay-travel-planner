-- People asking for the purchase service: a fixed fee to take one house from offer to notary.
create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists purchase_requests_user_listing on public.purchase_requests(user_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.purchase_requests enable row level security;
drop policy if exists "own purchase requests" on public.purchase_requests;
create policy "own purchase requests" on public.purchase_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
