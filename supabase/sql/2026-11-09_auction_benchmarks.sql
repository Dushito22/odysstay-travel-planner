-- Court auction benchmarks by Italy, region and property type, from ImmobilScan's observatory
-- (CC BY 4.0: reuse allowed with credit and the update date). Refreshed weekly by benchmarks-refresh.
create table if not exists public.auction_benchmarks (
  level text not null,
  code text not null default '',
  name text not null,
  category text not null default '',
  active_auctions integer,
  new_30d integer,
  starting_price_median numeric,
  starting_price_mean numeric,
  minimum_bid_mean numeric,
  average_price_cut_pct numeric,
  n_with_price_cut integer,
  updated_at timestamptz,
  source text,
  primary key (level, code, category)
);
alter table public.auction_benchmarks enable row level security;
drop policy if exists "benchmarks are public" on public.auction_benchmarks;
create policy "benchmarks are public" on public.auction_benchmarks for select to anon, authenticated using (true);
