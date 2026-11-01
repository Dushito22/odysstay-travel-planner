-- Who wants which paid plan, until payments are switched on.
create table if not exists public.plan_waitlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('explorer', 'buyer')),
  billing text not null default 'monthly' check (billing in ('monthly', 'yearly')),
  created_at timestamptz not null default now(),
  primary key (user_id, plan)
);
alter table public.plan_waitlist enable row level security;
drop policy if exists "own waitlist rows" on public.plan_waitlist;
create policy "own waitlist rows" on public.plan_waitlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
